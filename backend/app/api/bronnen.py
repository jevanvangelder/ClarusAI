from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from pydantic import BaseModel
from app.core.config import settings
from supabase import create_client, Client
import os
import uuid

router = APIRouter(prefix="/api/bronnen", tags=["bronnen"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
supabase_admin: Client = create_client(settings.SUPABASE_URL, os.getenv("SUPABASE_SERVICE_KEY", settings.SUPABASE_KEY))

BRONNEN_BUCKET = "bronnen-files"


# ============ MODELS ============

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    class_id: str

class FileMetadata(BaseModel):
    name: str
    folder_id: Optional[str] = None
    class_id: str


# ============ ENDPOINTS ============

@router.get("/folders")
async def get_folders(class_id: str, parent_id: Optional[str] = None):
    """Haal folders op voor een klas"""
    try:
        query = supabase.table("bronnen_folders")\
            .select("*")\
            .eq("class_id", class_id)
        
        if parent_id:
            query = query.eq("parent_id", parent_id)
        else:
            query = query.is_("parent_id", "null")
        
        response = query.order("name").execute()
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/folders")
async def create_folder(folder: FolderCreate, teacher_id: str):
    """Maak een nieuwe folder aan (docent/staff)"""
    try:
        insert_data = {
            "name": folder.name,
            "parent_id": folder.parent_id,
            "class_id": folder.class_id,
            "created_by": teacher_id,
        }
        
        response = supabase.table("bronnen_folders").insert(insert_data).execute()
        return response.data[0]
    except Exception as e:
        print(f"❌ Error aanmaken folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files")
async def get_files(class_id: str, folder_id: Optional[str] = None):
    """Haal bestanden op voor een klas/folder"""
    try:
        query = supabase.table("bronnen_files")\
            .select("*")\
            .eq("class_id", class_id)
        
        if folder_id:
            query = query.eq("folder_id", folder_id)
        else:
            query = query.is_("folder_id", "null")
        
        response = query.order("name").execute()
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen bestanden: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files")
async def upload_file(
    class_id: str = Form(...),
    folder_id: Optional[str] = Form(None),
    teacher_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload een bestand naar bronnen (docent/staff)"""
    try:
        # Upload naar Supabase Storage
        file_bytes = await file.read()
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        unique_name = f"{uuid.uuid4()}.{file_ext}"
        storage_path = f"classes/{class_id}/{unique_name}"
        
        supabase_admin.storage.from_(BRONNEN_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/pdf"}
        )
        
        file_url = supabase_admin.storage.from_(BRONNEN_BUCKET).get_public_url(storage_path)
        
        # Sla metadata op in database
        file_data = {
            "name": file.filename,
            "folder_id": folder_id,
            "class_id": class_id,
            "file_url": file_url,
            "file_size": len(file_bytes),
            "file_type": file.content_type,
            "uploaded_by": teacher_id,
        }
        
        response = supabase.table("bronnen_files").insert(file_data).execute()
        return response.data[0]
    except Exception as e:
        print(f"❌ Error uploaden bestand: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str):
    """Verwijder een folder (en alle sub-folders/bestanden)"""
    try:
        supabase.table("bronnen_folders").delete().eq("id", folder_id).execute()
        return {"message": "Folder verwijderd"}
    except Exception as e:
        print(f"❌ Error verwijderen folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Verwijder een bestand"""
    try:
        # Haal file info op
        file_info = supabase.table("bronnen_files").select("file_url").eq("id", file_id).execute()
        
        if file_info.data:
            # Verwijder uit Storage (optioneel)
            # storage_path = file_info.data[0]["file_url"].split("/")[-1]
            # supabase_admin.storage.from_(BRONNEN_BUCKET).remove([storage_path])
            pass
        
        # Verwijder uit database
        supabase.table("bronnen_files").delete().eq("id", file_id).execute()
        return {"message": "Bestand verwijderd"}
    except Exception as e:
        print(f"❌ Error verwijderen bestand: {e}")
        raise HTTPException(status_code=500, detail=str(e))