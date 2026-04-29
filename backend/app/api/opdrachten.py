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
import uuid

router = APIRouter(prefix="/api/opdrachten", tags=["opdrachten"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
supabase_admin: Client = create_client(settings.SUPABASE_URL, os.getenv("SUPABASE_SERVICE_KEY", settings.SUPABASE_KEY))

GOOGLE_SEARCH_KEY = os.getenv("GOOGLE_SEARCH_API_KEY", "")
GOOGLE_SEARCH_CX = os.getenv("GOOGLE_SEARCH_CX", "")
OPDRACHT_AFBEELDING_BUCKET = "opdracht-afbeeldingen"


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
    key = os.getenv("GOOGLE_SEARCH_API_KEY", "")
    cx = os.getenv("GOOGLE_SEARCH_CX", "")
    print(f"🔑 Google key: {key[:10]}... | cx: {cx[:10]}...")
    if not key or not cx:
        print("⚠️ Google Search keys niet ingesteld")
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": key,
                    "cx": cx,
                    "q": query,
                    "searchType": "image",
                    "num": 3,
                    "safe": "active",
                },
                timeout=8.0
            )
            data = resp.json()
            print(f"🔍 Google Search '{query}': status={resp.status_code}, items={len(data.get('items', []))}, error={data.get('error')}")
            items = data.get("items", [])
            if items:
                url = items[0].get("link")
                print(f"✅ Afbeelding gevonden: {url}")
                return url
    except Exception as e:
        print(f"❌ Google Search fout: {e}")
    return None


def upload_afbeelding_naar_supabase(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload een afbeelding naar Supabase Storage en geef de publieke URL terug."""
    ext = filename.split(".")[-1] if "." in filename else "png"
    unieke_naam = f"{uuid.uuid4()}.{ext}"
    storage_path = f"spar/{unieke_naam}"
    try:
        supabase_admin.storage.from_(OPDRACHT_AFBEELDING_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type}
        )
    except Exception as e:
        if "Duplicate" in str(e) or "already exists" in str(e):
            supabase_admin.storage.from_(OPDRACHT_AFBEELDING_BUCKET).update(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": content_type}
            )
        else:
            raise e
    url = supabase_admin.storage.from_(OPDRACHT_AFBEELDING_BUCKET).get_public_url(storage_path)
    print(f"✅ Afbeelding geüpload naar Supabase: {url}")
    return url


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


@router.post("/afbeelding/upload")
async def upload_afbeelding(file: UploadFile = File(...)):
    """Upload een afbeelding naar Supabase Storage en geef de publieke URL terug."""
    try:
        file_bytes = await file.read()
        content_type = file.content_type or "image/png"
        url = upload_afbeelding_naar_supabase(file_bytes, file.filename or "afbeelding.png", content_type)
        return {"url": url}
    except Exception as e:
        print(f"❌ Upload fout: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spar/chat")
async def spar_chat(body: SparChatMessage):
    try:
        json_voorbeeld = '''{
  "titel": "...",
  "beschrijving": "...",
  "type": "huiswerk|casus|oefentoets|opdracht",
  "max_punten": 10,
  "casussen": [
    {
      "id": "casus-1",
      "titel": "TechStart Startup",
      "tekst": "[200-400 woorden volledig uitgeschreven casus verhaal]",
      "volgorde": 1
    }
  ],
  "vragen": [
    {
      "nummer": 1,
      "vraag": "Welke strategieën kan TechStart overwegen?",
      "type": "open|meerkeuze|waar-onwaar|casus",
      "punten": 2,
      "opties": [],
      "antwoord": "...",
      "toelichting": "...",
      "afbeelding": "https://...",
      "casus_id": "casus-1"
    }
  ]
}'''

        system_prompt = (
            "Je bent een ervaren onderwijsassistent die docenten helpt bij het ontwerpen van opdrachten.\n\n"
            "Je kunt op twee manieren reageren:\n\n"
            "1. NORMAAL ANTWOORD: Als de docent een vraag stelt, advies wil of iets bespreekt — reageer dan gewoon als assistent in normaal Nederlands. Geen JSON.\n\n"
            "2. OPDRACHT GENEREREN/AANPASSEN: Alleen als de docent expliciet vraagt om een opdracht te maken of aan te passen.\n"
            "   In dat geval stuur je UITSLUITEND dit, zonder enige tekst ervoor of erna:\n"
            f"OPDRACHT_UPDATE:{json_voorbeeld}\n\n"
            "⚠️ ABSOLUUT VERBODEN bij een OPDRACHT_UPDATE:\n"
            "- Geen inleidende zin zoals 'Uiteraard, hier is de opdracht:'\n"
            "- Geen uitleg na de JSON\n"
            "- ALLEEN de prefix OPDRACHT_UPDATE: gevolgd door de JSON, niets anders\n\n"
            "KRITIEKE REGELS BIJ AANPASSEN VAN EEN BESTAANDE OPDRACHT:\n"
            "- Behoud ALTIJD alle bestaande vragen exact zoals ze zijn, tenzij de docent expliciet vraagt een vraag te verwijderen\n"
            "- Tel het aantal vragen in de context en zorg dat de output EXACT dat aantal + eventuele nieuwe vragen bevat\n"
            "- Als je een afbeelding toevoegt aan vraag X, kopieer dan alle andere vragen 1-op-1 zonder wijzigingen\n"
            "- Voeg nooit vragen toe die er niet waren, tenzij de docent dat vraagt\n"
            "- Behoud ALTIJD alle bestaande casussen en hun koppelingen\n\n"
            "🔥 NIEUW CASUS SYSTEEM (VERPLICHT TE GEBRUIKEN):\n\n"
            "STRUCTUUR:\n"
            "- 'casussen': aparte array met casus objecten\n"
            "- 'vragen': aparte array, casus vragen hebben 'casus_id' om te koppelen\n\n"
            "CASUS OBJECT:\n"
            "{\n"
            '  "id": "casus-1" (uniek, gebruik casus-1, casus-2, etc),\n'
            '  "titel": "Korte titel" (max 50 tekens, bijv. "TechStart Startup"),\n'
            '  "tekst": "[200-400 woorden volledig verhaal]" (GEEN placeholders!),\n'
            '  "volgorde": 1\n'
            "}\n\n"
            "CASUS VRAAG:\n"
            "{\n"
            '  "nummer": 1,\n'
            '  "vraag": "De vraag zelf" (GEEN casus tekst hier!),\n'
            '  "type": "casus",\n'
            '  "punten": 2,\n'
            '  "antwoord": "Modelantwoord",\n'
            '  "toelichting": "Feedback voor student",\n'
            '  "casus_id": "casus-1" (verwijzing naar de casus)\n'
            "}\n\n"
            "🎯 CHRONOLOGISCHE VOLGORDE (KRITIEK BELANGRIJK!):\n"
            "- Groepeer alle vragen PER CASUS in volgorde!\n"
            "- Als je 3 casussen hebt met elk 4 vragen, maak dan:\n"
            "  Vraag 1-4:  casus_id = 'casus-1'\n"
            "  Vraag 5-8:  casus_id = 'casus-2'\n"
            "  Vraag 9-12: casus_id = 'casus-3'\n"
            "- VERKEERDE volgorde (NOOIT DOEN): 1→5→9→2→6→10→3→7→11→4→8→12\n"
            "- JUISTE volgorde (ALTIJD DOEN):   1→2→3→4→5→6→7→8→9→10→11→12\n"
            "- Studenten moeten eerst casus A volledig afmaken, dan B, dan C\n\n"
            "BELANGRIJK:\n"
            "- Casus tekst staat ALLEEN in de 'casussen' array, NOOIT in de vraag zelf\n"
            "- Elke casus vraag moet een 'casus_id' hebben die verwijst naar een casus\n"
            "- De casus tekst moet 200-400 woorden zijn, volledig uitgeschreven, geen placeholders\n"
            "- Meerdere vragen kunnen aan dezelfde casus gekoppeld zijn\n"
            "- Je kunt meerdere casussen hebben in één opdracht\n\n"
            "AANTAL VRAGEN REGEL:\n"
            "- Als de docent zegt '2 casussen met beide 3 vragen', maak dan:\n"
            "  * 2 casus objecten in de 'casussen' array\n"
            "  * 6 totale vragen (3 voor casus-1, 3 voor casus-2)\n"
            "- Tel altijd na: aantal casus vragen met casus_id moet kloppen met wat gevraagd is\n"
            "- Als de docent '3 open, 2 meerkeuze, 2 casussen met 3 vragen' zegt:\n"
            "  * 3 open vragen (type='open')\n"
            "  * 2 meerkeuze vragen (type='meerkeuze')\n"
            "  * 2 casussen in 'casussen' array\n"
            "  * 6 casus vragen (type='casus', 3 met casus_id='casus-1', 3 met casus_id='casus-2')\n"
            "  * Totaal: 11 vragen\n\n"
            "VOORBEELD MIXED OPDRACHT:\n"
            "{\n"
            '  "titel": "Verkoopstrategie in Bedrijfskunde",\n'
            '  "type": "opdracht",\n'
            '  "casussen": [\n'
            "    {\n"
            '      "id": "casus-1",\n'
            '      "titel": "TechStart Startup",\n'
            '      "tekst": "TechStart is een startup die innovatieve softwareoplossingen ontwikkelt voor de gezondheidszorgsector. Ze hebben recent een nieuwe applicatie gelanceerd die patiëntgegevens efficiënter beheert. De concurrentie neemt toe met grote spelers die vergelijkbare producten aanbieden. TechStart overweegt hun marketingstrategie aan te passen om hun marktaandeel te vergroten. Ze hebben beperkt budget maar een sterk ontwikkelteam.",\n'
            '      "volgorde": 1\n'
            "    },\n"
            "    {\n"
            '      "id": "casus-2",\n'
            '      "titel": "Brewster\'s Coffee",\n'
            '      "tekst": "Brewster\'s Coffee is een lokaal koffiebedrijf dat ziet dat de verkoop daalt vanwege nieuwe concurrenten. Ze hebben besloten hun verkoopstrategie te herzien. Ze overwegen om hun doelgroep uit te breiden naar jongeren en studenten, en willen ook hun online aanwezigheid versterken.",\n'
            '      "volgorde": 2\n'
            "    }\n"
            "  ],\n"
            '  "vragen": [\n'
            "    {\n"
            '      "nummer": 1,\n'
            '      "vraag": "Wat is een verkoopstrategie?",\n'
            '      "type": "open",\n'
            '      "punten": 2,\n'
            '      "antwoord": "Een plan om producten/diensten te verkopen",\n'
            '      "toelichting": "Focus op doelgroep en aanpak"\n'
            "    },\n"
            "    {\n"
            '      "nummer": 2,\n'
            '      "vraag": "Welke strategieën kan TechStart overwegen om hun marktpositie te verbeteren?",\n'
            '      "type": "casus",\n'
            '      "punten": 3,\n'
            '      "antwoord": "Partnerschappen met ziekenhuizen, gerichte marketing naar zorgprofessionals, focus op USPs",\n'
            '      "toelichting": "Denk aan differentiatie en partnerships",\n'
            '      "casus_id": "casus-1"\n'
            "    },\n"
            "    {\n"
            '      "nummer": 3,\n'
            '      "vraag": "Hoe kan TechStart omgaan met de toenemende concurrentie?",\n'
            '      "type": "casus",\n'
            '      "punten": 3,\n'
            '      "antwoord": "Innovatie, klantenservice verbeteren, nichemarkt focussen",\n'
            '      "toelichting": "Bedenk strategieën voor competitief voordeel",\n'
            '      "casus_id": "casus-1"\n'
            "    },\n"
            "    {\n"
            '      "nummer": 4,\n'
            '      "vraag": "Welke stappen zou Brewster\'s Coffee kunnen nemen om hun nieuwe doelgroep effectief te bereiken?",\n'
            '      "type": "casus",\n'
            '      "punten": 2,\n'
            '      "antwoord": "Social media campagnes, influencer marketing, studentenkorting",\n'
            '      "toelichting": "Focus op kanalen die jongeren gebruiken",\n'
            '      "casus_id": "casus-2"\n'
            "    },\n"
            "    {\n"
            '      "nummer": 5,\n'
            '      "vraag": "Hoe kan Brewster\'s hun online aanwezigheid versterken?",\n'
            '      "type": "casus",\n'
            '      "punten": 2,\n'
            '      "antwoord": "Website verbeteren, online bestelsysteem, social media content",\n'
            '      "toelichting": "Denk aan digitale marketingstrategieën",\n'
            '      "casus_id": "casus-2"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "AFBEELDINGEN:\n"
            "- Voeg ALLEEN een afbeelding toe als de docent er expliciet om vraagt of als het absoluut noodzakelijk is voor de vraag\n"
            "- Als de docent een afbeelding heeft meegestuurd (te herkennen aan [AFBEELDING_URL:...]), gebruik dan die URL direct in het 'afbeelding' veld\n"
            "- Voor casus opdrachten zijn afbeeldingen meestal NIET nodig — de tekst moet voldoende zijn\n"
            "- Voeg NOOIT automatisch afbeeldingen toe zonder expliciete vraag van de docent\n\n"
            "Regels:\n"
            "- Stel verhelderingsvragen als onderwerp, niveau of aantal vragen onduidelijk is\n"
            "- Genereer ALLEEN een OPDRACHT_UPDATE als de docent expliciet om een opdracht vraagt\n"
        )

        if body.context:
            system_prompt += (
                f"\n\nDe docent werkt aan deze BESTAANDE opdracht. "
                f"Dit is de VOLLEDIGE en MEEST RECENTE versie. Neem ALLE vragen en casussen over en pas ALLEEN aan wat gevraagd wordt:\n{body.context}"
            )

        conversation = list(body.messages) if body.messages else []
        conversation.append({"role": "user", "content": body.content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="teacher",
            module_prompts=[system_prompt],
        )

        PREFIX = "OPDRACHT_UPDATE:"
        if PREFIX in response:
            try:
                idx = response.index(PREFIX)
                parsed = json.loads(response[idx + len(PREFIX):].strip())
                vragen = parsed.get("vragen", [])
                casussen = parsed.get("casussen", [])
                print(f"📝 AI genereerde {len(vragen)} vragen en {len(casussen)} casussen")
                for vraag in vragen:
                    zoekterm = vraag.pop("afbeelding_zoekterm", None)
                    if zoekterm and not vraag.get("afbeelding"):
                        print(f"🔍 Zoeken afbeelding voor vraag {vraag.get('nummer')}: '{zoekterm}'")
                        url = await zoek_educatieve_afbeelding(zoekterm)
                        if url:
                            vraag["afbeelding"] = url
                parsed["vragen"] = vragen
                return {"message": f"{PREFIX}{json.dumps(parsed)}"}
            except Exception as e:
                print(f"⚠️ Kon afbeeldingen niet verwerken: {e}")
                traceback.print_exc()

        return {"message": response}

    except Exception as e:
        print(f"❌ SPAR CHAT error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spar/upload")
async def spar_upload(
    content: str = Form(...),
    messages: Optional[str] = Form("[]"),
    context: Optional[str] = Form(""),
    files: List[UploadFile] = File(None),
):
    try:
        message_history = json.loads(messages) if messages else []
        file_context = ""
        images = []
        uploaded_image_urls = []

        if files:
            parts = []
            for file in files:
                file_bytes = await file.read()
                parsed = parse_file(file.filename, file_bytes)
                if parsed["type"] == "image":
                    try:
                        content_type = file.content_type or "image/png"
                        public_url = upload_afbeelding_naar_supabase(file_bytes, file.filename or "afbeelding.png", content_type)
                        uploaded_image_urls.append(public_url)
                        parts.append(f"=== AFBEELDING: {file.filename} (URL: {public_url}) ===")
                    except Exception as upload_err:
                        print(f"⚠️ Upload naar Supabase mislukt: {upload_err}")
                        parts.append(f"=== AFBEELDING: {file.filename} ===")
                    if parsed.get("image"):
                        images.append(parsed["image"])
                else:
                    parts.append(f"=== BESTAND: {file.filename} ===\n{parsed['text']}")
            file_context = "\n\n".join(parts)

        enhanced_content = content
        if uploaded_image_urls:
            urls_text = " ".join([f"[AFBEELDING_URL:{url}]" for url in uploaded_image_urls])
            enhanced_content = f"{content}\n\n{urls_text}"

        system_prompt = (
            "Je bent een ervaren onderwijsassistent die docenten helpt bij het ontwerpen van opdrachten.\n\n"
            "Je kunt op twee manieren reageren:\n\n"
            "1. NORMAAL ANTWOORD: Als de docent een vraag stelt of advies wil — reageer normaal in het Nederlands.\n\n"
            "2. OPDRACHT AANPASSEN: Als de docent vraagt een afbeelding toe te voegen of de opdracht aan te passen.\n"
            "   In dat geval stuur je UITSLUITEND dit, zonder enige tekst ervoor of erna:\n"
            "OPDRACHT_UPDATE:{...json...}\n\n"
            "⚠️ ABSOLUUT VERBODEN bij een OPDRACHT_UPDATE:\n"
            "- Geen inleidende zin zoals 'Uiteraard, hier is de opdracht:'\n"
            "- Geen uitleg na de JSON\n"
            "- ALLEEN de prefix OPDRACHT_UPDATE: gevolgd door de JSON, niets anders\n\n"
            "🔥 NIEUW CASUS SYSTEEM (VERPLICHT TE GEBRUIKEN):\n\n"
            "STRUCTUUR:\n"
            "- 'casussen': aparte array met casus objecten [{id, titel, tekst, volgorde}]\n"
            "- 'vragen': aparte array, casus vragen hebben 'casus_id' om te koppelen\n\n"
            "🎯 CHRONOLOGISCHE VOLGORDE (KRITIEK BELANGRIJK!):\n"
            "- Groepeer alle vragen PER CASUS in volgorde!\n"
            "- Als je 3 casussen hebt met elk 4 vragen, maak dan:\n"
            "  Vraag 1-4:  casus_id = 'casus-1'\n"
            "  Vraag 5-8:  casus_id = 'casus-2'\n"
            "  Vraag 9-12: casus_id = 'casus-3'\n"
            "- Studenten moeten eerst casus A volledig afmaken, dan B, dan C\n\n"
            "BELANGRIJK:\n"
            "- Casus tekst staat ALLEEN in de 'casussen' array, NOOIT in de vraag zelf\n"
            "- Elke casus vraag moet een 'casus_id' hebben die verwijst naar een casus\n"
            "- De casus tekst moet 200-400 woorden zijn, volledig uitgeschreven\n"
            "- Meerdere vragen kunnen aan dezelfde casus gekoppeld zijn\n\n"
            "AANTAL VRAGEN REGEL:\n"
            "- Als de docent zegt '2 casussen met beide 3 vragen', maak dan 6 totale casus vragen (3 voor casus-1, 3 voor casus-2)\n"
            "- Tel altijd na: aantal casus vragen met casus_id moet kloppen\n\n"
            "AFBEELDINGEN:\n"
            "- Voeg ALLEEN een afbeelding toe als de docent er expliciet om vraagt\n"
            "- Als de docent een afbeelding heeft meegestuurd (te herkennen aan [AFBEELDING_URL:...]), gebruik dan die URL\n"
            "- Voor casus opdrachten zijn afbeeldingen meestal NIET nodig\n"
            "- Voeg NOOIT automatisch afbeeldingen toe zonder expliciete vraag\n\n"
            "KRITIEKE REGELS:\n"
            "- Behoud ALTIJD alle bestaande vragen en casussen exact zoals ze zijn\n"
            "- Als de docent zegt 'voeg deze afbeelding toe aan vraag X', gebruik dan de [AFBEELDING_URL:...] uit de tekst als 'afbeelding' waarde voor die vraag\n"
            "- Kopieer alle andere vragen en casussen 1-op-1 zonder wijzigingen\n"
        )

        if context:
            system_prompt += (
                f"\n\nDe docent werkt aan deze BESTAANDE opdracht. "
                f"Neem ALLE vragen en casussen over en pas ALLEEN aan wat gevraagd wordt:\n{context}"
            )

        conversation = []
        if file_context:
            conversation.append({"role": "system", "content": f"Bronmateriaal:\n\n{file_context}"})
        conversation.extend(message_history)
        conversation.append({"role": "user", "content": enhanced_content})

        response = await ai_service.generate_response(
            messages=conversation,
            role="teacher",
            module_prompts=[system_prompt],
            images=images if images else None,
        )

        PREFIX = "OPDRACHT_UPDATE:"
        if PREFIX in response:
            try:
                idx = response.index(PREFIX)
                parsed = json.loads(response[idx + len(PREFIX):].strip())
                return {"message": f"{PREFIX}{json.dumps(parsed)}"}
            except Exception as e:
                print(f"⚠️ Kon OPDRACHT_UPDATE niet parsen: {e}")

        return {"message": response}

    except Exception as e:
        print(f"❌ SPAR UPLOAD error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))