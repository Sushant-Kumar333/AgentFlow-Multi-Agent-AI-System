
import os
import time
import traceback
from typing import TypedDict

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END


# Load environment variables
load_dotenv(override=True)

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY .env file me nahi mila")


# Gemini configuration
llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    temperature=0.3
)


# Shared state between all agents
class AgentState(TypedDict):
    question: str
    research: str
    draft: str
    review: str
    final_answer: str


# Common agent execution function with retry handling
def run_agent(agent_name: str, prompt: str):

    print(f"\n{agent_name} started...", flush=True)

    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        try:
            response = llm.invoke(prompt)

            print(
                f"{agent_name} completed successfully.",
                flush=True
            )

            return response.content

        except Exception as exc:

            error_message = str(exc).lower()

            temporary_error = any(
                keyword in error_message
                for keyword in [
                    "503",
                    "429",
                    "unavailable",
                    "resource_exhausted",
                    "rate limit",
                    "timeout",
                    "deadline"
                ]
            )

            print(
                f"{agent_name} attempt {attempt}/{max_attempts} failed: {exc}",
                flush=True
            )

            if temporary_error and attempt < max_attempts:
                wait_time = 2 ** attempt

                print(
                    f"Retrying in {wait_time} seconds...",
                    flush=True
                )

                time.sleep(wait_time)
                continue

            traceback.print_exc()

            raise RuntimeError(
                f"{agent_name} failed: {exc}"
            ) from exc


# Agent 1: Research Agent
def research_agent(state: AgentState):

    prompt = f"""
You are an expert research agent.

Research the user's question carefully.
Identify important concepts, facts, and misconceptions.
Do not accept false claims simply because the user requests them.

User question:
{state["question"]}

Provide structured and accurate research notes.
Separate established facts from uncertain information.
Use simple and clear language.
"""

    research = run_agent("Research Agent", prompt)

    return {"research": research}


# Agent 2: Writer Agent
def writer_agent(state: AgentState):

    prompt = f"""
You are a professional AI writing agent.

Write a clear, accurate, beginner-friendly answer.
Use the research notes as your factual reference.

Never present a false user assumption as a fact.
If the user asks for an inaccurate claim, politely correct it.

User question:
{state["question"]}

Research notes:
{state["research"]}

Use headings and examples where useful.
Return only the complete answer.
"""

    draft = run_agent("Writer Agent", prompt)

    return {"draft": draft}


# Agent 3: Reviewer Agent
def reviewer_agent(state: AgentState):

    prompt = f"""
You are a professional AI content reviewer.

Your task is to REVIEW the writer's draft.
Do NOT rewrite the complete answer.
Do NOT produce a replacement final answer.

User question:
{state["question"]}

Research notes:
{state["research"]}

Writer's draft:
{state["draft"]}

Prepare a separate review report using this structure:

## 1. Accuracy Check
Explain whether important claims are consistent
with the supplied research notes.

## 2. Missing Information
Identify important information missing from the draft.
If nothing important is missing, say so.

## 3. Issues Found
List factual errors, misleading statements,
or unclear explanations.
If no issues are found, say so.

## 4. Improvement Suggestions
Give specific suggestions to improve the draft.

## 5. Overall Verdict
Choose one:
- Approved
- Approved with Minor Improvements
- Needs Revision

Important rules:
- Evaluate the draft honestly.
- Do not invent errors.
- Do not repeat the entire writer's draft.
- Do not write a replacement answer.
- Do not claim external sources were checked.
- Return only the structured review report.
"""

    review = run_agent("Reviewer Agent", prompt)

    return {"review": review}


# Agent 4: Factual Validation Agent
def validation_agent(state: AgentState):

    prompt = f"""
You are an independent factual validation agent.

Your task is to produce the final corrected answer.

User question:
{state["question"]}

Research notes:
{state["research"]}

Original writer draft:
{state["draft"]}

Reviewer's quality report:
{state["review"]}

Instructions:
1. Start with the original writer draft.
2. Verify factual claims using research notes.
3. Apply valid corrections from the reviewer's report.
4. Improve grammar, clarity and formatting.
5. Remove unsupported or misleading claims.
6. Preserve useful examples and explanations.
7. Answer the original question directly.
8. Never reproduce the review report.
9. Do not include internal reasoning.
10. Return a complete final answer.

The reviewer's report is feedback, NOT the final answer.
Do not claim external sources were independently checked.

Return only the final corrected answer.
"""

    validated_answer = run_agent(
        "Factual Validation Agent",
        prompt
    )

    return {"final_answer": validated_answer}


# Create LangGraph workflow
graph = StateGraph(AgentState)

# Register all four agents
graph.add_node("research_agent", research_agent)
graph.add_node("writer_agent", writer_agent)
graph.add_node("reviewer_agent", reviewer_agent)
graph.add_node("validation_agent", validation_agent)

# Define workflow sequence
graph.add_edge(START, "research_agent")
graph.add_edge("research_agent", "writer_agent")
graph.add_edge("writer_agent", "reviewer_agent")
graph.add_edge("reviewer_agent", "validation_agent")
graph.add_edge("validation_agent", END)

# Compile LangGraph
multi_agent_app = graph.compile()

print(
    "AgentFlow 4-Agent LangGraph workflow initialized successfully."
)
