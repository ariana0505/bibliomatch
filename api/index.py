from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime
from bson import ObjectId
import os

load_dotenv()
app = Flask(__name__)
CORS(app)
db = MongoClient(os.getenv("MONGO_URL"))["bibliomatch"]

db.usuarios.create_index("apodo", unique=True)
db.opiniones.create_index([("libro_id", 1), ("usuario_id", 1)], unique=True)

def limpiar(doc):
    doc["_id"] = str(doc["_id"])
    return doc

@app.post("/api/registro")
def registro():
    d = request.json
    if db.usuarios.find_one({"apodo": d["apodo"]}):
        return jsonify(error="Ese apodo ya está tomado"), 409
    db.usuarios.insert_one({
        "apodo": d["apodo"],
        "contrasena_hash": generate_password_hash(d["contrasena"]),
        "rol": "estudiante", "nombre_real": None,
        "grado": d.get("grado"), "seccion": d.get("seccion"),
        "creado_en": datetime.now(),
    })
    return jsonify(ok=True)

@app.post("/api/login")
def login():
    d = request.json
    u = db.usuarios.find_one({"apodo": d["apodo"]})
    if not u or not check_password_hash(u["contrasena_hash"], d["contrasena"]):
        return jsonify(error="Apodo o contraseña incorrectos"), 401
    return jsonify(apodo=u["apodo"], rol=u["rol"], grado=u.get("grado"), seccion=u.get("seccion"))

@app.get("/api/libros")
def libros():
    out = []
    for l in db.libros.find():
        abierto = db.prestamos.find_one({"libro_id": l["_id"], "fecha_devolucion_real": None})
        l = limpiar(l)
        l["estado"] = "Prestado" if abierto else "Disponible"
        out.append(l)
    return jsonify(out)

@app.post("/api/libros")
def crear_libro():
    d = request.json
    r = db.libros.insert_one({
        "titulo": d["titulo"], "autor": d.get("autor", ""), "area": d.get("area", "LIT"),
        "sinopsis": d.get("sinopsis", ""), "foto": d.get("foto", ""),
        "ubicacion": d.get("ubicacion", ""), "donante": d.get("donante", ""),
        "creado_en": datetime.now(),
    })
    return jsonify(id=str(r.inserted_id))

if __name__ == "__main__":
    app.run(port=5000, debug=True)
