from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.core.config import settings
from supabase import create_client, Client
import os

router = APIRouter(prefix="/api/vakken", tags=["vakken"])
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
supabase_admin: Client = create_client(
    settings.SUPABASE_URL, 
    os.getenv("SUPABASE_SERVICE_KEY", settings.SUPABASE_KEY)
)


# ============ MODELS ============

class VakCreate(BaseModel):
    name: str
    color: Optional[str] = "blue"
    icon: Optional[str] = "BookOpen"
    display_order: Optional[int] = 0

class VakUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


# ============ ENDPOINTS ============

@router.get("")
async def get_vakken(school_id: str, include_inactive: bool = False):
    """Haal alle vakken op voor een school"""
    try:
        query = supabase.table("vakken")\
            .select("*")\
            .eq("school_id", school_id)\
            .order("display_order")
        
        if not include_inactive:
            query = query.eq("is_active", True)
        
        response = query.execute()
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen vakken: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_vak_templates(category: Optional[str] = None):
    """Haal vak templates op (voor nieuwe scholen)"""
    try:
        query = supabase_admin.table("vak_templates").select("*").order("display_order")
        
        if category:
            query = query.eq("category", category)
        
        response = query.execute()
        return response.data
    except Exception as e:
        print(f"❌ Error ophalen templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-templates")
async def import_templates(
    school_id: str, 
    user_id: str,
    category: Optional[str] = None,
    template_ids: Optional[List[str]] = None
):
    """Importeer templates naar school vakken"""
    try:
        # Haal templates op
        query = supabase_admin.table("vak_templates").select("*")
        
        if template_ids:
            query = query.in_("id", template_ids)
        elif category:
            query = query.eq("category", category)
        
        templates = query.execute().data
        
        if not templates:
            raise HTTPException(status_code=404, detail="Geen templates gevonden")
        
        # Maak vakken aan voor deze school
        vakken_to_insert = []
        for template in templates:
            vakken_to_insert.append({
                "school_id": school_id,
                "name": template["name"],
                "color": template["color"],
                "icon": template["icon"],
                "display_order": template["display_order"],
                "created_by": user_id
            })
        
        response = supabase_admin.table("vakken").insert(vakken_to_insert).execute()
        return {"message": f"{len(response.data)} vakken geïmporteerd", "vakken": response.data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error importeren templates: {e}")
        
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail="Sommige vakken bestaan al voor deze school")
        
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_vak(vak: VakCreate, school_id: str, user_id: str):
    """Maak een nieuw vak aan voor een school"""
    try:
        insert_data = {
            "school_id": school_id,
            "name": vak.name,
            "color": vak.color,
            "icon": vak.icon,
            "display_order": vak.display_order,
            "created_by": user_id,
        }
        
        response = supabase_admin.table("vakken").insert(insert_data).execute()
        return response.data[0]
    except Exception as e:
        print(f"❌ Error aanmaken vak: {e}")
        
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail="Een vak met deze naam bestaat al voor deze school")
        
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{vak_id}")
async def update_vak(vak_id: str, vak: VakUpdate):
    """Update een vak"""
    try:
        update_data = {k: v for k, v in vak.dict(exclude_unset=True).items()}
        update_data["updated_at"] = "NOW()"
        
        response = supabase_admin.table("vakken").update(update_data).eq("id", vak_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Vak niet gevonden")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updaten vak: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{vak_id}")
async def delete_vak(vak_id: str, hard_delete: bool = False):
    """Verwijder een vak (soft delete standaard)"""
    try:
        # Check of er klassen aan dit vak gekoppeld zijn
        classes_check = supabase_admin.table("classes")\
            .select("id", count="exact")\
            .eq("vak_id", vak_id)\
            .execute()
        
        if classes_check.count and classes_check.count > 0:
            raise HTTPException(
                status_code=409, 
                detail=f"Kan vak niet verwijderen: er zijn {classes_check.count} klas(sen) aan gekoppeld"
            )
        
        if hard_delete:
            supabase_admin.table("vakken").delete().eq("id", vak_id).execute()
        else:
            supabase_admin.table("vakken").update({"is_active": False}).eq("id", vak_id).execute()
        
        return {"message": "Vak verwijderd"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verwijderen vak: {e}")
        raise HTTPException(status_code=500, detail=str(e))