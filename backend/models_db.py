from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Roadmap(Base):
    __tablename__ = "roadmaps"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(200), index=True, nullable=False, default="public_user")
    name = Column(String(200), index=True, nullable=False)
    raw_text = Column(Text, nullable=False, default="")
    document_json = Column(Text, nullable=False, default="[]")
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    timeframes = relationship(
        "Timeframe",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="Timeframe.position, Timeframe.id",
    )

class Timeframe(Base):
    __tablename__ = "timeframes"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(500), nullable=False)
    granularity = Column(String(40), nullable=False, default="section")
    # parent_id = Column(Integer, ForeignKey("timeframes.id"), nullable=True) # Not strictly used yet but kept for schema compatibility
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    position = Column(Integer, nullable=False, default=0)

    roadmap = relationship("Roadmap", back_populates="timeframes")
    tasks = relationship(
        "Task",
        back_populates="timeframe",
        cascade="all, delete-orphan",
        order_by="Task.position, Task.id",
    )

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    timeframe_id = Column(Integer, ForeignKey("timeframes.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    details = Column(String, nullable=True)
    is_done = Column(Boolean, nullable=False, default=False)
    properties_json = Column(Text, nullable=False, default="{}")
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    timeframe = relationship("Timeframe", back_populates="tasks")
    blocks = relationship(
        "TaskBlock",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskBlock.position, TaskBlock.id",
    )


class TaskBlock(Base):
    __tablename__ = "task_blocks"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(40), nullable=False)
    data_json = Column(Text, default="{}", nullable=False)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    updated_at = Column(
        String,
        nullable=False,
        default=lambda: datetime.now().isoformat(),
        onupdate=lambda: datetime.now().isoformat(),
    )

    task = relationship("Task", back_populates="blocks")

# Removed ActivityLog as streak system was deleted
