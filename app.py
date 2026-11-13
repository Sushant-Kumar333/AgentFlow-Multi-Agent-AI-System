from langgraph.graph import StateGraph, START, END
from typing import TypedDict


class AgentState(TypedDict):
    message: str


def greeting_agent(state: AgentState):
    print("Greeting Agent is running...")

    return {
        "message": "Hello! Multi-Agent AI System started successfully."
    }


graph = StateGraph(AgentState)

graph.add_node("greeting_agent", greeting_agent)

graph.add_edge(START, "greeting_agent")
graph.add_edge("greeting_agent", END)

app = graph.compile()

result = app.invoke({
    "message": "Start"
})

print(result)