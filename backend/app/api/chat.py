from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json

from app.services.ai_service import ai_service
from app.utils.file_parser import parse_file

router = APIRouter(prefix="/api/chat", tags=["chat"])


# Request/Response models
class ChatMessage(BaseModel):
    content: str
    messages: Optional[List[dict]] = []
    active_module_ids: Optional[List[str]] = []
    active_module_prompts: Optional[List[str]] = []


class ChatResponse(BaseModel):
    message: str


# Send a chat message (WITHOUT files)
@router.post("/send", response_model=ChatResponse)
async def send_message(message: ChatMessage):
    """Send a message and get AI response"""

    conversation_messages = message.messages if message.messages else []
    if not conversation_messages:
        conversation_messages = [{"role": "user", "content": message.content}]

    module_prompts = message.active_module_prompts if message.active_module_prompts else []

    ai_response = await ai_service.generate_response(
        messages=conversation_messages,
        role="student",
        module_prompts=module_prompts,
    )

    return ChatResponse(message=ai_response)


# Send a chat message WITH files
@router.post("/send-with-files", response_model=ChatResponse)
async def send_message_with_files(
    content: str = Form(...),
    files: List[UploadFile] = File(None),
    messages: Optional[str] = Form("[]"),
    active_module_ids: Optional[str] = Form("[]"),
    active_module_prompts: Optional[str] = Form("[]"),
):
    """Send a message with file attachments and get AI response"""

    # Parse JSON strings
    try:
        message_history = json.loads(messages) if messages else []
    except json.JSONDecodeError:
        message_history = []

    try:
        parsed_module_prompts = json.loads(active_module_prompts) if active_module_prompts else []
    except json.JSONDecodeError:
        parsed_module_prompts = []

    # Process uploaded files
    file_context = ""
    images = []

    if files:
        file_parts = []
        for file in files:
            file_bytes = await file.read()
            parsed = parse_file(file.filename, file_bytes)

            if parsed["type"] == "image":
                if parsed["image"]:
                    images.append(parsed["image"])
                file_parts.append(f"=== AFBEELDING: {file.filename} ===\n\n[Zie afbeelding in bericht]")
            else:
                file_parts.append(f"=== BESTAND: {file.filename} ===\n\n{parsed['text']}")

        file_context = "\n\n".join(file_parts)

    # Build conversation messages
    conversation_messages = []

    if file_context:
        conversation_messages.append({
            "role": "system",
            "content": f"De gebruiker heeft de volgende documenten geüpload. Gebruik deze informatie voor ALLE vragen in dit gesprek:\n\n{file_context}",
        })

    conversation_messages.extend(message_history)
    conversation_messages.append({
        "role": "user",
        "content": content if content else "Bestanden geüpload",
    })

    module_prompts = parsed_module_prompts if parsed_module_prompts else []

    ai_response = await ai_service.generate_response(
        messages=conversation_messages,
        role="student",
        images=images if images else None,
        module_prompts=module_prompts,
    )

    return ChatResponse(message=ai_response)