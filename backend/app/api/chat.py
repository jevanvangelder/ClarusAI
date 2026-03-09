from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.database import User, Conversation, Message, UserRole
from app.services.ai_service import ai_service
from app.utils.file_parser import parse_file

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Request/Response models
class ChatMessage(BaseModel):
    content: str
    messages: Optional[List[dict]] = []
    active_module_ids: Optional[List[str]] = []  # ← NIEUW!

class ChatResponse(BaseModel):
    message: str
    conversation_id: int
    timestamp: datetime

class ConversationHistory(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime  

# Send a chat message (WITHOUT files)
@router.post("/send", response_model=ChatResponse)
async def send_message(
    message: ChatMessage,
    conversation_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Send a message and get AI response
    
    For now, we'll use a default test user (user_id=1)
    Later we'll add authentication
    """
    
    # Get or create test user (temporary, until we add auth)
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(
            email="test@clarusai.nl",
            username="testuser",
            hashed_password="temp",
            full_name="Test User",
            role=UserRole.STUDENT
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Get or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            user_id=user.id,
            title=message.content[:50]  # Use first 50 chars as title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    
    # Use message history from frontend (localStorage)
    conversation_messages = message.messages if message.messages else []
    if not conversation_messages:
        conversation_messages = [{"role": "user", "content": message.content}]

    # ✅ NEW: Get active modules and their prompts
    module_prompts = []
    # TODO: Implement Module model in database.py first
    # For now, modules are disabled until we add the Module table
    # if message.active_module_ids:
    #     from app.models.database import Module
    #     modules = db.query(Module).filter(
    #         Module.id.in_(message.active_module_ids),
    #         Module.is_active == True
    #     ).all()
    #     module_prompts = [m.system_prompt for m in modules]

    ai_response = await ai_service.generate_response(
        messages=conversation_messages,
        role=user.role.value,
        module_prompts=module_prompts  # ← Empty for now
    )
    
    # Save AI response
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response
    )
    db.add(assistant_message)
    db.commit()
    
    return ChatResponse(
        message=ai_response,
        conversation_id=conversation.id,
        timestamp=assistant_message.created_at
    )


# Send a chat message WITH files (supports images!)
@router.post("/send-with-files", response_model=ChatResponse)
async def send_message_with_files(
    content: str = Form(...),
    files: List[UploadFile] = File(None),
    messages: Optional[str] = Form("[]"),
    active_module_ids: Optional[str] = Form("[]"),  # ← NIEUW!
    conversation_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Send a message with file attachments and get AI response
    Supports images (PNG, JPG) with GPT-4 Vision!
    """
    import json
    
    # Parse messages from JSON string
    try:
        message_history = json.loads(messages) if messages else []
    except json.JSONDecodeError:
        message_history = []
    
    # ✅ NEW: Parse active_module_ids from JSON string
    try:
        parsed_module_ids = json.loads(active_module_ids) if active_module_ids else []
    except json.JSONDecodeError:
        parsed_module_ids = []
    
    # Get or create test user
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(
            email="test@clarusai.nl",
            username="testuser",
            hashed_password="temp",
            full_name="Test User",
            role=UserRole.STUDENT
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Get or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            user_id=user.id,
            title=content[:50]
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # ✅ Process uploaded files (including images!)
    file_context = ""
    images = []  # Store base64 images for Vision API
    
    if files:
        file_parts = []
        for file in files:
            file_bytes = await file.read()
            parsed = parse_file(file.filename, file_bytes)  # Returns dict now!
            
            if parsed["type"] == "image":
                # Store image for Vision API
                if parsed["image"]:
                    images.append(parsed["image"])
                file_parts.append(f"=== AFBEELDING: {file.filename} ===\n\n[Zie afbeelding in bericht]")
            else:
                # Regular text file
                file_parts.append(f"=== BESTAND: {file.filename} ===\n\n{parsed['text']}")
        
        file_context = "\n\n".join(file_parts)
    
    # Add file content as a system message at the start
    conversation_messages = []
    
    if file_context:
        conversation_messages.append({
            "role": "system",
            "content": f"De gebruiker heeft de volgende documenten geüpload. Gebruik deze informatie voor ALLE vragen in dit gesprek, ook toekomstige vragen:\n\n{file_context}"
        })
    
    # Add message history from frontend
    conversation_messages.extend(message_history)
    
    # Add current user message
    conversation_messages.append({
        "role": "user",
        "content": content if content else "Bestanden geüpload"
    })
    
    # Save user message with file info indicator
    user_message_content = content if content else "Bestanden geüpload"
    if files:
        file_names = ", ".join([f.filename for f in files])
        user_message_content += f"\n\n📎 Bijlagen: {file_names}"
    
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=user_message_content
    )
    db.add(user_message)
    db.commit()
    
    # ✅ NEW: Get active modules and their prompts
    module_prompts = []
    # TODO: Implement Module model in database.py first
    # For now, modules are disabled until we add the Module table
    # if parsed_module_ids:
    #     from app.models.database import Module
    #     modules = db.query(Module).filter(
    #         Module.id.in_(parsed_module_ids),
    #         Module.is_active == True
    #     ).all()
    #     module_prompts = [m.system_prompt for m in modules]
    
    # ✅ Generate AI response with images and module prompts!
    ai_response = await ai_service.generate_response(
        messages=conversation_messages,
        role=user.role.value,
        images=images if images else None,
        module_prompts=module_prompts  # ← Empty for now
    )
    
    # Save AI response
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response
    )
    db.add(assistant_message)
    db.commit()
    
    return ChatResponse(
        message=ai_response,
        conversation_id=conversation.id,
        timestamp=assistant_message.created_at
    )


# Get conversation history
@router.get("/history/{conversation_id}", response_model=List[ConversationHistory])
async def get_conversation_history(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation"""
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at).all()
    
    return [
        ConversationHistory(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at
        )
        for msg in messages
    ]