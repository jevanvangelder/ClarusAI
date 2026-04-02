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
import httpx
import os

router = APIRouter(prefix="/api/opdrachten", tags=["opdrachten"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

GOOGLE_SEARCH_KEY = os.getenv("GOOGLE_SEARCH_API_KEY", "")
GOOGLE_SEARCH_CX = os.getenv("GOOGLE_SEARCH_CX", "")


# ============ MODELS ============

class OpdachtCreate(BaseModel):
    titel: str
    beschrijving: Optional[str] = ""
    klas_id: Optional[str] = None
    klas_ids: Optional[List[str]] = []
    teacher_id: str
    deadline: Optional[str] = None
    type: Optional[str] = "huiswerk"
    vragen: Optional[list] = []
    max_punten: Optional[int] = 10

class OpdachtUpdate(BaseModel):
    titel: Optional[str] = None
    beschrijving: Optional[str] = None
    klas_id: Optional[str] = None
    klas_ids: Optional[List[str]] = None
    deadline: Optional[str] = None
    type: Optional[str] = None
    vragen: Optional[list] = None
    max_punten: Optional[int] = None
    is_actief: Optional[bool] = None

class SparChatMessage(BaseModel):
    content: str
    messages: Optional[List[dict]] = []
    context: Optional[str] = ""

class AfbeeldingZoekRequest(BaseModel):
    query: str


# ============ HELPERS ============

async def zoek_educatieve_afbeelding(query: str) -> Optional[str]:
    """Zoek een educatieve afbeelding via Google Custom Search."""
    if not GOOGLE_SEARCH_KEY or not GOOGLE_SEARCH_CX:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": GOOGLE_SEARCH_KEY,
                    "cx": GOOGLE_SEARCH_CX,
                    "q": query,
                    "searchType": "image",
                    "num": 5,
                    "safe": "active",
                },
                timeout=8.0
            )
            data = resp.json()
            items = data.get("items", [])
            for item in items:
                url = item.get("link", "")
                if url and any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']):
                    return url
            if items:
                return items[0].get("link")
    except Exception as e:
        print(f"❌ Google Search fout: {e}")
    return None


# ============ ENDPOINTS ============

@router.get("")
async def get_opdrachten(teacher_id: str):
    try:
        response = supabase.table("opdrachten").select("*").eq("teacher_id", teacher_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_opdracht(opdracht: OpdachtCreate):
    try:
        insert_data = {
            "titel": opdracht.titel,
            "beschrijving": opdracht.beschrijving or "",
            "teacher_id": opdracht.teacher_id,
            "type": opdracht.type or "huiswerk",
            "vragen": opdracht.vragen or [],
            "max_punten": opdracht.max_punten or 10,
            "klas_ids": opdracht.klas_ids or [],
            "is_actief": False,
        }
        if opdracht.klas_id:
            insert_data["klas_id"] = opdracht.klas_id
        if opdracht.deadline:
            insert_data["deadline"] = opdracht.deadline
        response = supabase.table("opdrachten").insert(insert_data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{opdracht_id}")
async def update_opdracht(opdracht_id: str, opdracht: OpdachtUpdate):
    try:
        update_data = {"updated_at": datetime.now().isoformat()}
        if opdracht.titel is not None: update_data["titel"] = opdracht.titel
        if opdracht.beschrijving is not None: update_data["beschrijving"] = opdracht.beschrijving
        if opdracht.klas_id is not None: update_data["klas_id"] = opdracht.klas_id
        if opdracht.klas_ids is not None: update_data["klas_ids"] = opdracht.klas_ids
        if opdracht.deadline is not None: update_data["deadline"] = opdracht.deadline
        if opdracht.type is not None: update_data["type"] = opdracht.type
        if opdracht.vragen is not None: update_data["vragen"] = opdracht.vragen
        if opdracht.max_punten is not None: update_data["max_punten"] = opdracht.max_punten
        if opdracht.is_actief is not None: update_data["is_actief"] = opdracht.is_actief

        response = supabase.table("opdrachten").update(update_data).eq("id", opdracht_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Opdracht niet gevonden")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{opdracht_id}")
async def delete_opdracht(opdracht_id: str):
    try:
        supabase.table("opdracht_inzendingen").delete().eq("opdracht_id", opdracht_id).execute()
        supabase.table("opdrachten").delete().eq("id", opdracht_id).execute()
        return {"message": "Opdracht verwijderd"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/afbeelding/zoek")
async def zoek_afbeelding(req: AfbeeldingZoekRequest):
    """Zoek een educatieve afbeelding via Google Custom Search."""
    url = await zoek_educatieve_afbeelding(req.query)
    if not url:
        raise HTTPException(status_code=404, detail="Geen afbeelding gevonden")
    return {"url": url, "query": req.query}


@router.post("/spar/chat")
async def spar_chat(body: SparChatMessage):
    try:
        json_voorbeeld = '{"titel":"...","beschrijving":"...","type":"huiswerk|casus|oefentoets|opdracht","max_punten":10,"vragen":[{"nummer":1,"vraag":"...","type":"open|meerkeuze|waar-onwaar","punten":2,"opties":["A","B"],"antwoord":"correct antwoord","toelichting":"uitleg","afbeelding_zoekterm":"optionele Engelse zoekterm voor educatieve afbeelding"}]}'

        system_prompt = (
            "Je bent een ervaren onderwijsassistent die docenten helpt bij het ontwerpen van opdrachten.\n\n"
            "Je kunt op twee manieren reageren:\n\n"
            "1. NORMAAL ANTWOORD: Als de docent een vraag stelt, advies wil of iets bespreekt — reageer dan gewoon als assistent in normaal Nederlands. Geen JSON.\n\n"
            "2. OPDRACHT GENEREREN/AANPASSEN: Alleen als de docent expliciet vraagt om een opdracht te maken of aan te passen:\n"
            f"OPDRACHT_UPDATE:{json_voorbeeld}\n\n"
            "AFBEELDINGEN:\n"
            "- Als een vraag een afbeelding nodig heeft (bijv. een diagram, schema, grafiek, lege invultabel), voeg dan het veld 'afbeelding_zoekterm' toe aan die vraag.\n"
            "- Gebruik een beschrijvende Engelse zoekterm die goed werkt voor educatief materiaal (bijv. 'blank balance sheet template', 'supply and demand graph economics', 'human heart anatomy diagram', 'empty t-account bookkeeping').\n"
            "- Voeg ALLEEN een zoekterm toe als een afbeelding echt zinvol is voor de vraag.\n\n"
            "Regels:\n"
            "- Stel verhelderingsvragen als onderwerp, niveau of aantal vragen onduidelijk is\n"
            "- Genereer ALLEEN een OPDRACHT_UPDATE als de docent expliciet om een opdracht vraagt\n"
            "- Bij een OPDRACHT_UPDATE: stuur ALLEEN de prefix + JSON, geen uitleg\n"
        )

        if body.context:
            system_prompt += f"\n\nDe docent werkt aan deze bestaande opdracht:\n{body.context}"

        conversation = list(body.messages) if body.messages else []
        conversation.append({"role": "user", "content": body.content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="teacher",
            module_prompts=[system_prompt],
        )

        # Verwerk OPDRACHT_UPDATE en zoek afbeeldingen automatisch via Google
        PREFIX = "OPDRACHT_UPDATE:"
        if response.startswith(PREFIX):
            try:
                parsed = json.loads(response[len(PREFIX):].strip())
                vragen = parsed.get("vragen", [])
                for vraag in vragen:
                    zoekterm = vraag.pop("afbeelding_zoekterm", None)
                    if zoekterm and not vraag.get("afbeelding"):
                        url = await zoek_educatieve_afbeelding(zoekterm)
                        if url:
                            vraag["afbeelding"] = url
                parsed["vragen"] = vragen
                return {"message": f"{PREFIX}{json.dumps(parsed)}"}
            except Exception as e:
                print(f"⚠️ Kon afbeeldingen niet verwerken: {e}")

        return {"message": response}

    except Exception as e:
        print(f"❌ SPAR CHAT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
                    if parsed.get("image"): images.append(parsed["image"])
                    parts.append(f"=== AFBEELDING: {file.filename} ===")
                else:
                    parts.append(f"=== BESTAND: {file.filename} ===\n{parsed['text']}")
            file_context = "\n\n".join(parts)

        system_prompt = (
            "Je bent een ervaren onderwijsassistent. Analyseer het meegestuurde materiaal en help de docent.\n"
            "Als de docent een opdracht wil genereren op basis van het materiaal, stuur dan:\n"
            "OPDRACHT_UPDATE:{...json...}\n"
            "Anders antwoord je normaal."
        )
        conversation = []
        if file_context:
            conversation.append({"role": "system", "content": f"Bronmateriaal:\n\n{file_context}"})
        conversation.extend(message_history)
        conversation.append({"role": "user", "content": content})

        response = await ai_service.generate_response(
            messages=conversation, role="teacher", module_prompts=[system_prompt],
            images=images if images else None,
        )
        return {"message": response}
    except Exception as e:
        print(f"❌ SPAR UPLOAD error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))