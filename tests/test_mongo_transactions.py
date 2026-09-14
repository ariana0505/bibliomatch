"""Integration tests: use only a disposable replica set via MONGO_TEST_URL."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from bson import ObjectId
from flask import g
from pymongo import MongoClient

import api.index as backend


@pytest.fixture()
def mongo_db(monkeypatch):
    uri = os.getenv("MONGO_TEST_URL")
    if not uri:
        pytest.skip("MONGO_TEST_URL is required for replica-set integration tests")
    connection = MongoClient(uri, serverSelectionTimeoutMS=2000)
    deadline = time.monotonic() + 30
    while True:
        try:
            if connection.admin.command("hello").get("isWritablePrimary"):
                break
        except Exception:
            if time.monotonic() >= deadline:
                connection.close()
                raise
        if time.monotonic() >= deadline:
            pytest.fail("Replica set did not elect a primary")
        time.sleep(0.2)
    name = f"bibliomatch_test_{uuid4().hex}"
    database = connection[name]
    monkeypatch.setitem(backend.app.config, "TEST_TRANSACTION_RUNNER", None)
    monkeypatch.setitem(backend.app.config, "TEST_DB", database)
    for collection in ("libros", "prestamos", "solicitudes"):
        database.create_collection(collection)
    try:
        yield database
    finally:
        connection.drop_database(name)
        connection.close()


@pytest.mark.parametrize("same_borrower", [False, True])
def test_real_transactions_prevent_overbooking_and_duplicates(mongo_db, same_borrower):
    book = {"_id": ObjectId(), "titulo": "Concurrent book", "ejemplares_total": 2 if same_borrower else 1}
    mongo_db.libros.insert_one(book)
    users = [{"_id": ObjectId(), "apodo": "one"}, {"_id": ObjectId(), "apodo": "two"}]
    if same_borrower:
        users[1] = users[0]
    start = Barrier(2)
    def borrow(user):
        with backend.app.test_request_context():
            g.current_user = {"_id": ObjectId()}
            start.wait(timeout=5)
            try:
                backend.create_loan(mongo_db, book, user, "2099-01-01")
                return "created"
            except backend.ApiError as error:
                return error.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(borrow, users))
    assert sorted(results) == sorted(["created", "duplicate_loan" if same_borrower else "book_unavailable"])
    assert mongo_db.prestamos.count_documents({"estado": "activo"}) == 1


def test_real_transaction_rolls_back_partial_writes(mongo_db):
    request_id = mongo_db.solicitudes.insert_one({"estado": "pendiente"}).inserted_id
    def failing_operation(session):
        mongo_db.solicitudes.update_one({"_id": request_id}, {"$set": {"estado": "aprobada"}}, session=session)
        mongo_db.prestamos.insert_one({"estado": "activo"}, session=session)
        raise backend.ApiError("Simulated failure", 409)
    with pytest.raises(backend.ApiError):
        backend.run_transaction(mongo_db, failing_operation)
    assert mongo_db.solicitudes.find_one({"_id": request_id})["estado"] == "pendiente"
    assert mongo_db.prestamos.count_documents({}) == 0
