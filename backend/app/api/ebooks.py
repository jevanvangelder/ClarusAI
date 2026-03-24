from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.config import settings
from supabase import create_client, Client
import io

# Text extraction
import PyPDF2
try:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup
    EPUB_SUPPORT = True
except ImportError:
    EPUB_SUPPORT = False
    print("⚠️ ebooklib not installed - EPUB support disabled")

router = APIRouter(prefix="/api/ebooks", tags=["ebooks"])

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

BUCKET_NAME = "ebook-storage"
MAX_TEXT_LENGTH = 100000  # ~100K characters max voor AI context


# Pydantic models
class EbookResponse(BaseModel):
    id: str
    user_id: str
    title: str
    author: str
    file_name: str
    file_type: str
    file_size: int
    file_url: str
    cover_emoji: str
    subject: str
    favorite: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EbookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    cover_emoji: Optional[str] = None
    subject: Optional[str] = None
    favorite: Optional[bool] = None
    is_active: Optional[bool] = None


# ✅ Helper: Extract text from PDF
def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page_num, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"--- Pagina {page_num + 1} ---\n{page_text}")
        full_text = "\n\n".join(text_parts)
        if len(full_text) > MAX_TEXT_LENGTH:
            full_text = full_text[:MAX_TEXT_LENGTH] + "\n\n[... tekst afgekort vanwege limiet ...]"
        return full_text
    except Exception as e:
        print(f"❌ Error extracting PDF text: {e}")
        return f"[Kon tekst niet extraheren uit PDF: {str(e)}]"


# ✅ Helper: Extract text from EPUB
def extract_text_from_epub(file_bytes: bytes) -> str:
    if not EPUB_SUPPORT:
        return "[EPUB support niet beschikbaar op server]"
    try:
        book = epub.read_epub(io.BytesIO(file_bytes))
        text_parts = []
        chapter_num = 0
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                chapter_num += 1
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                chapter_text = soup.get_text(separator='\n', strip=True)
                if chapter_text.strip():
                    text_parts.append(f"--- Hoofdstuk {chapter_num} ---\n{chapter_text}")
        full_text = "\n\n".join(text_parts)
        if len(full_text) > MAX_TEXT_LENGTH:
            full_text = full_text[:MAX_TEXT_LENGTH] + "\n\n[... tekst afgekort vanwege limiet ...]"
        return full_text
    except Exception as e:
        print(f"❌ Error extracting EPUB text: {e}")
        return f"[Kon tekst niet extraheren uit EPUB: {str(e)}]"


# ✅ Helper: Detect file type and extract text
def extract_text(file_bytes: bytes, file_name: str) -> str:
    lower_name = file_name.lower()
    if lower_name.endswith('.pdf'):
        return extract_text_from_pdf(file_bytes)
    elif lower_name.endswith('.epub'):
        return extract_text_from_epub(file_bytes)
    elif lower_name.endswith('.txt'):
        try:
            return file_bytes.decode('utf-8')[:MAX_TEXT_LENGTH]
        except:
            return file_bytes.decode('latin-1')[:MAX_TEXT_LENGTH]
    elif lower_name.endswith(('.mobi', '.azw3', '.kfx', '.iba')):
        return "[Dit bestandsformaat wordt nog niet ondersteund voor tekstextractie. PDF en EPUB worden wel ondersteund.]"
    else:
        return "[Onbekend bestandsformaat]"


# ✅ Helper: Auto-detect cover emoji based on file name
def detect_cover_emoji(file_name: str) -> str:
    lower = file_name.lower()
    if any(w in lower for w in ['wiskunde', 'math', 'rekenen']):
        return '📕'
    elif any(w in lower for w in ['engels', 'english']):
        return '📘'
    elif any(w in lower for w in ['biologie', 'biology', 'bio']):
        return '📗'
    elif any(w in lower for w in ['natuur', 'physics', 'scheikunde', 'chemistry']):
        return '📙'
    elif any(w in lower for w in ['geschied', 'history']):
        return '📔'
    elif any(w in lower for w in ['aard', 'geo']):
        return '🗺️'
    elif any(w in lower for w in ['nederland', 'dutch']):
        return '📖'
    else:
        return '📘'


# GET /api/ebooks?user_id= — Alle ebooks voor een user
@router.get("", response_model=List[EbookResponse])
async def get_ebooks(user_id: str):
    try:
        response = supabase.table("ebooks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ebooks/upload — Nieuw ebook uploaden
@router.post("/upload", response_model=EbookResponse)
async def upload_ebook(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    title: str = Form(""),
    author: str = Form(""),
    subject: str = Form(""),
    cover_emoji: str = Form(""),
):
    try:
        # Valideer bestandstype
        allowed_extensions = ['.pdf', '.epub', '.mobi', '.azw3', '.kfx', '.iba', '.txt']
        file_ext = '.' + file.filename.lower().split('.')[-1] if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Bestandstype niet ondersteund. Toegestaan: {', '.join(allowed_extensions)}"
            )

        # Lees bestand
        file_bytes = await file.read()
        file_size = len(file_bytes)

        print(f"📚 Uploading ebook: {file.filename} ({file_size} bytes)")

        # Upload naar Supabase Storage
        storage_path = f"{user_id}/{file.filename}"
        try:
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
        except Exception as storage_error:
            # Als bestand al bestaat, overschrijf het
            if "Duplicate" in str(storage_error) or "already exists" in str(storage_error):
                supabase.storage.from_(BUCKET_NAME).update(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": file.content_type or "application/octet-stream"}
                )
            else:
                raise storage_error

        # Genereer publieke URL
        file_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)

        # Extract tekst uit bestand
        print(f"📖 Extracting text from {file.filename}...")
        extracted_text = extract_text(file_bytes, file.filename)
        print(f"✅ Extracted {len(extracted_text)} characters")

        # Auto-detect emoji als niet opgegeven
        final_emoji = cover_emoji if cover_emoji else detect_cover_emoji(file.filename)

        # Gebruik bestandsnaam als titel als niet opgegeven
        final_title = title if title else file.filename.rsplit('.', 1)[0]

        # Sla op in database
        insert_data = {
            "user_id": user_id,
            "title": final_title,
            "author": author,
            "file_name": file.filename,
            "file_type": file_ext.replace('.', ''),
            "file_size": file_size,
            "file_url": file_url,
            "extracted_text": extracted_text,
            "cover_emoji": final_emoji,
            "subject": subject,
            "favorite": False,
            "is_active": False,
        }

        response = supabase.table("ebooks").insert(insert_data).execute()
        print(f"✅ Ebook saved to database: {response.data[0]['id']}")

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error uploading ebook: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/ebooks/{ebook_id} — Ebook bijwerken
@router.put("/{ebook_id}", response_model=EbookResponse)
async def update_ebook(ebook_id: str, ebook: EbookUpdate):
    try:
        update_data = {}
        if ebook.title is not None:
            update_data["title"] = ebook.title
        if ebook.author is not None:
            update_data["author"] = ebook.author
        if ebook.cover_emoji is not None:
            update_data["cover_emoji"] = ebook.cover_emoji
        if ebook.subject is not None:
            update_data["subject"] = ebook.subject
        if ebook.favorite is not None:
            update_data["favorite"] = ebook.favorite
        if ebook.is_active is not None:
            update_data["is_active"] = ebook.is_active

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = supabase.table("ebooks").update(update_data).eq("id", ebook_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Ebook not found")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ebooks/{ebook_id}/add-document — Voeg extra document toe aan bestaand ebook
@router.post("/{ebook_id}/add-document", response_model=EbookResponse)
async def add_document_to_ebook(
    ebook_id: str,
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    try:
        # Haal bestaand ebook op
        existing = supabase.table("ebooks").select("*").eq("id", ebook_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Ebook not found")

        ebook = existing.data[0]

        # Lees en extraheer tekst uit nieuw bestand
        file_bytes = await file.read()
        new_text = extract_text(file_bytes, file.filename)

        # Combineer tekst
        old_text = ebook.get("extracted_text", "") or ""
        combined_text = old_text + f"\n\n--- {file.filename} ---\n\n" + new_text

        # Beperk tot max lengte
        if len(combined_text) > MAX_TEXT_LENGTH:
            combined_text = combined_text[:MAX_TEXT_LENGTH] + "\n\n[... tekst afgekort vanwege limiet ...]"

        # Upload nieuw bestand naar storage
        storage_path = f"{user_id}/{file.filename}"
        try:
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
        except Exception as storage_error:
            if "Duplicate" in str(storage_error) or "already exists" in str(storage_error):
                supabase.storage.from_(BUCKET_NAME).update(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": file.content_type or "application/octet-stream"}
                )
            else:
                raise storage_error

        # Update ebook met gecombineerde tekst en nieuwe bestandsgrootte
        new_size = ebook.get("file_size", 0) + len(file_bytes)
        response = supabase.table("ebooks").update({
            "extracted_text": combined_text,
            "file_size": new_size,
        }).eq("id", ebook_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# DELETE /api/ebooks/{ebook_id} — Ebook verwijderen
@router.delete("/{ebook_id}")
async def delete_ebook(ebook_id: str):
    try:
        # Haal ebook op voor file path
        ebook_response = supabase.table("ebooks").select("*").eq("id", ebook_id).execute()
        if not ebook_response.data:
            raise HTTPException(status_code=404, detail="Ebook not found")

        ebook = ebook_response.data[0]

        # Verwijder uit Storage
        try:
            storage_path = f"{ebook['user_id']}/{ebook['file_name']}"
            supabase.storage.from_(BUCKET_NAME).remove([storage_path])
            print(f"🗑️ Removed file from storage: {storage_path}")
        except Exception as e:
            print(f"⚠️ Could not remove file from storage: {e}")

        # Verwijder uit database
        supabase.table("ebooks").delete().eq("id", ebook_id).execute()

        return {"message": "Ebook deleted", "ebook_id": ebook_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET /api/ebooks/{ebook_id}/text — Haal extracted tekst op (voor AI)
@router.get("/{ebook_id}/text")
async def get_ebook_text(ebook_id: str):
    try:
        response = supabase.table("ebooks").select("id, title, author, extracted_text").eq("id", ebook_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Ebook not found")

        ebook = response.data[0]
        return {
            "id": ebook["id"],
            "title": ebook["title"],
            "author": ebook["author"],
            "text": ebook["extracted_text"],
            "text_length": len(ebook["extracted_text"]) if ebook["extracted_text"] else 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))