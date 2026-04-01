from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.config import settings
from app.services.ai_service import ai_service
from app.utils.file_parser import parse_file
from supabase import create_client, Client
import json
import traceback

router = APIRouter(prefix="/api/opdrachten", tags=["opdrachten"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# ============ MODELS ============

class OpdachtCreate(BaseModel):
    titel: str
    beschrijving: Optional[str] = ""
    klas_id: Optional[str] = None
    teacher_id: str
    deadline: Optional[str] = None
    type: Optional[str] = "huiswerk"
    vragen: Optional[list] = []
    max_punten: Optional[int] = 10

class OpdachtUpdate(BaseModel):
    titel: Optional[str] = None
    beschrijving: Optional[str] = None
    klas_id: Optional[str] = None
    deadline: Optional[str] = None
    type: Optional[str] = None
    vragen: Optional[list] = None
    max_punten: Optional[int] = None
    is_actief: Optional[bool] = None

class SparChatMessage(BaseModel):
    content: str
    messages: Optional[List[dict]] = []
    context: Optional[str] = ""


# ============ ENDPOINTS ============

# GET /api/opdrachten?teacher_id=
@router.get("")
async def get_opdrachten(teacher_id: str):
    try:
        response = supabase.table("opdrachten").select("*").eq("teacher_id", teacher_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"❌ GET opdrachten error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# GET /api/opdrachten/{id}
@router.get("/{opdracht_id}")
async def get_opdracht(opdracht_id: str):
    try:
        response = supabase.table("opdrachten").select("*").eq("id", opdracht_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Opdracht niet gevonden")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ GET opdracht error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/opdrachten
@router.post("")
async def create_opdracht(opdracht: OpdachtCreate):
    try:
        print(f"🔍 CREATE OPDRACHT: {opdracht.titel}")
        print(f"  vragen count: {len(opdracht.vragen) if opdracht.vragen else 0}")

        insert_data = {
            "titel": opdracht.titel,
            "beschrijving": opdracht.beschrijving or "",
            "teacher_id": opdracht.teacher_id,
            "type": opdracht.type or "huiswerk",
            "vragen": json.dumps(opdracht.vragen) if opdracht.vragen else json.dumps([]),
            "max_punten": opdracht.max_punten or 10,
            "is_actief": False,
        }

        if opdracht.klas_id:
            insert_data["klas_id"] = opdracht.klas_id
        if opdracht.deadline:
            insert_data["deadline"] = opdracht.deadline

        print(f"  insert_data keys: {list(insert_data.keys())}")
        response = supabase.table("opdrachten").insert(insert_data).execute()
        print(f"✅ Opdracht created: {response.data[0]['id']}")
        return response.data[0]
    except Exception as e:
        print(f"❌ CREATE opdracht error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/opdrachten/{id}
@router.put("/{opdracht_id}")
async def update_opdracht(opdracht_id: str, opdracht: OpdachtUpdate):
    try:
        update_data = {"updated_at": datetime.now().isoformat()}
        if opdracht.titel is not None:
            update_data["titel"] = opdracht.titel
        if opdracht.beschrijving is not None:
            update_data["beschrijving"] = opdracht.beschrijving
        if opdracht.klas_id is not None:
            update_data["klas_id"] = opdracht.klas_id
        if opdracht.deadline is not None:
            update_data["deadline"] = opdracht.deadline
        if opdracht.type is not None:
            update_data["type"] = opdracht.type
        if opdracht.vragen is not None:
            update_data["vragen"] = json.dumps(opdracht.vragen)
        if opdracht.max_punten is not None:
            update_data["max_punten"] = opdracht.max_punten
        if opdracht.is_actief is not None:
            update_data["is_actief"] = opdracht.is_actief

        response = supabase.table("opdrachten").update(update_data).eq("id", opdracht_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Opdracht niet gevonden")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UPDATE opdracht error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# DELETE /api/opdrachten/{id}
@router.delete("/{opdracht_id}")
async def delete_opdracht(opdracht_id: str):
    try:
        supabase.table("opdracht_inzendingen").delete().eq("opdracht_id", opdracht_id).execute()
        supabase.table("opdrachten").delete().eq("id", opdracht_id).execute()
        return {"message": "Opdracht verwijderd"}
    except Exception as e:
        print(f"❌ DELETE opdracht error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/opdrachten/spar/chat
@router.post("/spar/chat")
async def spar_chat(body: SparChatMessage):
    try:
        json_voorbeeld = (
            '{"titel": "...", "beschrijving": "...", "type": "huiswerk|casus|oefentoets|anders", '
            '"max_punten": 10, "vragen": [{"nummer": 1, "vraag": "...", "type": "open|meerkeuze|waar-onwaar", '
            '"punten": 2, "opties": ["optie A", "optie B"], "antwoord": "het correcte antwoord", '
            '"toelichting": "waarom dit het juiste antwoord is"}]}'
        )

        system_prompt = (
            "Je bent een ervaren onderwijsassistent die docenten helpt bij het ontwerpen van opdrachten. "
            "Je helpt met het maken van huiswerk, casussen, oefentoetsen en andere opdrachten.\n\n"
            "Stel eerst verhelderingsvragen als de docent nog niet duidelijk heeft aangegeven:\n"
            "- Welk vak / onderwerp?\n"
            "- Welk niveau (vmbo, havo, vwo)?\n"
            "- Hoeveel vragen?\n"
            "- Welk type opdracht?\n\n"
            "Zodra je genoeg weet, genereer je de opdracht als geldig JSON object (geen markdown, geen uitleg eromheen):\n"
            + json_voorbeeld
        )

        if body.context:
            system_prompt += f"\n\nHuidige concept-opdracht van de docent:\n{body.context}"

        conversation = list(body.messages) if body.messages else []
        conversation.append({"role": "user", "content": body.content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="teacher",
            module_prompts=[system_prompt],
        )
        return {"message": response}
    except Exception as e:
        print(f"❌ SPAR CHAT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/opdrachten/spar/upload
@router.post("/spar/upload")
async def spar_upload(
    content: str = Form(...),
    messages: Optional[str] = Form("[]"),
    files: List[UploadFile] = File(None),
):
    try:
        message_history = json.loads(messages) if messages else []

        file_context = ""
        images = []
        if files:
            parts = []
            for file in files:
                file_bytes = await file.read()
                parsed = parse_file(file.filename, file_bytes)
                if parsed["type"] == "image":
                    if parsed.get("image"):
                        images.append(parsed["image"])
                    parts.append(f"=== AFBEELDING: {file.filename} ===\n[Zie afbeelding]")
                else:
                    parts.append(f"=== BESTAND: {file.filename} ===\n{parsed['text']}")
            file_context = "\n\n".join(parts)

        system_prompt = (
            "Je bent een ervaren onderwijsassistent die docenten helpt bij het ontwerpen van opdrachten op basis van bronmateriaal. "
            "Analyseer het meegestuurde materiaal en help de docent een passende opdracht te maken. "
            "Zodra je genoeg informatie hebt, genereer je de opdracht als geldig JSON object (geen markdown, geen uitleg eromheen)."
        )

        conversation = []
        if file_context:
            conversation.append({
                "role": "system",
                "content": f"Bronmateriaal van de docent:\n\n{file_context}"
            })
        conversation.extend(message_history)
        conversation.append({"role": "user", "content": content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="teacher",
            module_prompts=[system_prompt],
            images=images if images else None,
        )
        return {"message": response}
    except Exception as e:
        print(f"❌ SPAR UPLOAD error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))