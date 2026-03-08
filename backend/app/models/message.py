from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
from datetime import datetime

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    
    # Image support
    has_image = Column(Boolean, default=False)
    image_url = Column(Text)
    
    # Metadata
    tokens_used = Column(Integer)
    model_used = Column(String(100))
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    chat = relationship("Chat", back_populates="messages")