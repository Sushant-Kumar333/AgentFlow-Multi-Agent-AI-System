
import json
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4

from backend.agents import multi_agent_app
from backend.database import conversations_collection


app = FastAPI(
    title="Multi-Agent AI System API",
    version="0.1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request model
class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


# Home route
@app.get("/")
def home():
    return {
        "message": "Multi-Agent AI Backend is running"
    }


# Convert response into string
def convert_to_text(value):

    if value is None:
        return ""

    if isinstance(value, str):
        return value

    if isinstance(value, list):
        response_text = []

        for item in value:
            if isinstance(item, str):
                response_text.append(item)

            elif isinstance(item, dict):
                text = (
                    item.get("text")
                    or item.get("content")
                    or str(item)
                )
                response_text.append(str(text))

            else:
                response_text.append(str(item))

        return "\n".join(response_text)

    if isinstance(value, dict):
        return str(
            value.get("text")
            or value.get("content")
            or value
        )

    return str(value)


# Chat route
@app.post("/api/chat")
def chat(data: ChatRequest):

    try:

        if not data.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty."
            )

        conversation_id = (
            data.conversation_id or str(uuid4())
        )

        print("\nStarting LangGraph...")

        # Run 4-agent workflow
        result = multi_agent_app.invoke(
            {
                "question": data.message,
                "research": "",
                "draft": "",
                "review": "",
                "final_answer": "",
            }
        )

        # Extract agent outputs
        research = convert_to_text(
            result.get("research", "")
        )

        draft = convert_to_text(
            result.get("draft", "")
        )

        review = convert_to_text(
            result.get("review", "")
        )

        final_answer = convert_to_text(
            result.get("final_answer")
            or result.get("response")
        )
        print("\n===== AGENT OUTPUT DEBUG =====")
        print("REVIEWER OUTPUT:", review[:300])
        print("FINAL ANSWER:", final_answer[:300])
        print("==============================\n")
        

        if not final_answer.strip():
            final_answer = "No final response was generated."

        # Save conversation in MongoDB
        current_time = datetime.now(timezone.utc)

        conversations_collection.update_one(
            {
                "conversation_id": conversation_id
            },
            {
                "$setOnInsert": {
                    "conversation_id": conversation_id,
                    "created_at": current_time,
                },
                "$set": {
                    "updated_at": current_time,
                },
                "$push": {
                    "messages": {
                        "user": data.message,
                        "research": research,
                        "draft": draft,
                        "review": review,
                        "assistant": final_answer,
                        "timestamp": current_time,
                    }
                },
            },
            upsert=True
        )

        print("Conversation saved in MongoDB!")

        return {
            "success": True,
            "conversation_id": conversation_id,
            "research": research,
            "draft": draft,
            "review": review,
            "response": final_answer,
        }

    except HTTPException:
        raise

    except Exception as e:

        print("ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# Get all conversations
@app.get("/api/conversations")
def get_all_conversations():

    try:
        conversations = conversations_collection.find(
            {},
            {
                "_id": 0,
                "conversation_id": 1,
                "messages": 1,
                "created_at": 1,
                "updated_at": 1,
            }
        ).sort("updated_at", -1)

        history = []

        for conversation in conversations:

            messages = conversation.get("messages", [])
            last_message = messages[-1] if messages else {}

            history.append({
                "conversation_id": conversation.get("conversation_id"),
                "message_count": len(messages),
                "preview": last_message.get("user", ""),
                "created_at": conversation.get("created_at"),
                "updated_at": conversation.get("updated_at"),
            })

        return {
            "success": True,
            "total": len(history),
            "conversations": history,
        }

    except Exception as e:

        print("HISTORY ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# Get conversation history
@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):

    try:
        conversation = conversations_collection.find_one(
            {"conversation_id": conversation_id},
            {"_id": 0}
        )

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found."
            )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "messages": conversation.get("messages", []),
            "created_at": conversation.get("created_at"),
            "updated_at": conversation.get("updated_at"),
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# Streaming chat route
@app.post("/api/chat/stream")
def chat_stream(data: ChatRequest):

    if not data.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    conversation_id = data.conversation_id or str(uuid4())

    def generate_events():

        research = ""
        draft = ""
        review = ""
        final_answer = ""

        agents = [
            ("research_agent", "Research Agent"),
            ("writer_agent", "Writer Agent"),
            ("reviewer_agent", "Reviewer Agent"),
            ("validation_agent", "Factual Validation Agent"),
        ]

        try:

            # Start first agent
            yield f"data: {json.dumps({
                'type': 'status',
                'agent': 'Research Agent',
                'status': 'running'
            })}\n\n"

            # Stream LangGraph node updates
            for update in multi_agent_app.stream(
                {
                    "question": data.message,
                    "research": "",
                    "draft": "",
                    "review": "",
                    "final_answer": "",
                },
                stream_mode="updates"
            ):

                for node_name, state_update in update.items():

                    # Extract completed agent output
                    if node_name == "research_agent":

                        research = convert_to_text(
                            state_update.get("research", "")
                        )

                    elif node_name == "writer_agent":

                        draft = convert_to_text(
                            state_update.get("draft", "")
                        )

                    elif node_name == "reviewer_agent":

                        review = convert_to_text(
                            state_update.get("review", "")
                        )

                    elif node_name == "validation_agent":

                        final_answer = convert_to_text(
                            state_update.get("final_answer", "")
                        )

                    # Send completed status
                    completed_agent = next(
                        (
                            label
                            for key, label in agents
                            if key == node_name
                        ),
                        node_name
                    )

                    yield f"data: {json.dumps({
                        'type': 'status',
                        'agent': completed_agent,
                        'status': 'completed'
                    })}\n\n"

                    # Mark next agent as running
                    current_index = next(
                        (
                            i
                            for i, (key, _) in enumerate(agents)
                            if key == node_name
                        ),
                        -1
                    )

                    if 0 <= current_index < len(agents) - 1:

                        next_agent = agents[current_index + 1][1]

                        yield f"data: {json.dumps({
                            'type': 'status',
                            'agent': next_agent,
                            'status': 'running'
                        })}\n\n"

            if not final_answer.strip():
                final_answer = "No final response was generated."

            # Save conversation in MongoDB
            current_time = datetime.now(timezone.utc)

            conversations_collection.update_one(
                {"conversation_id": conversation_id},
                {
                    "$setOnInsert": {
                        "conversation_id": conversation_id,
                        "created_at": current_time,
                    },
                    "$set": {
                        "updated_at": current_time,
                    },
                    "$push": {
                        "messages": {
                            "user": data.message,
                            "research": research,
                            "draft": draft,
                            "review": review,
                            "assistant": final_answer,
                            "timestamp": current_time,
                        }
                    },
                },
                upsert=True
            )

            # Send final result
            yield f"data: {json.dumps({
                'type': 'complete',
                'success': True,
                'conversation_id': conversation_id,
                'research': research,
                'draft': draft,
                'review': review,
                'response': final_answer
            })}\n\n"

        except Exception as e:

            print("STREAM ERROR:", repr(e))

            yield f"data: {json.dumps({
                'type': 'error',
                'message': str(e)
            })}\n\n"

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
