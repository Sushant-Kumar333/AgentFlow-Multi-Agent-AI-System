\# AgentFlow – Multi-Agent AI System with LangGraph



AgentFlow is an AI-powered multi-agent application that uses LangGraph to process user queries through multiple specialized AI agents. It generates research notes, creates a draft, reviews the draft, and produces a final answer.



\## Features



\- Multi-agent workflow using LangGraph

\- Research Agent for gathering relevant information

\- Writer Agent for generating structured drafts

\- Reviewer Agent for checking accuracy and quality

\- Validation Agent for producing the final answer

\- Gemini AI integration

\- React-based interactive frontend

\- FastAPI backend

\- MongoDB Atlas conversation history

\- Chat history and workspace interface

\- Separate tabs for Research Notes, Writer Draft, Reviewer Output, and Final Answer



\## Architecture



```text

User Query

&#x20;   |

&#x20;   v

Research Agent

&#x20;   |

&#x20;   v

Writer Agent

&#x20;   |

&#x20;   v

Reviewer Agent

&#x20;   |

&#x20;   v

Validation Agent

&#x20;   |

&#x20;   v

Final Answer

```



\## Tech Stack



\*\*Frontend:\*\* React, Vite, JavaScript, CSS



\*\*Backend:\*\* Python, FastAPI



\*\*AI \& Workflow:\*\* LangGraph, LangChain, Google Gemini



\*\*Database:\*\* MongoDB Atlas



\## Project Structure



```text

AgentFlow/

├── backend/

│   ├── agents.py

│   ├── database.py

│   └── main.py

├── frontend/

│   ├── src/

│   ├── public/

│   └── package.json

├── .gitignore

├── requirements.txt

└── README.md

```



\## Installation and Setup



\### 1. Clone the repository



```bash

git clone https://github.com/Sushant-Kumar333/AgentFlow-Multi-Agent-AI-System.git

cd AgentFlow-Multi-Agent-AI-System

```



\### 2. Backend Setup



Create and activate a virtual environment:



```bash

python -m venv venv

```



Windows PowerShell:



```powershell

.\\venv\\Scripts\\Activate.ps1

```



Install dependencies:



```bash

pip install -r requirements.txt

```



Configure your environment variables in a `.env` file:



```env

GOOGLE\_API\_KEY=your\_google\_api\_key

MONGODB\_URI=your\_mongodb\_connection\_string

```



Start the backend:



```bash

python -m uvicorn backend.main:app --reload

```



Backend API: http://127.0.0.1:8000



API documentation: http://127.0.0.1:8000/docs



\### 3. Frontend Setup



Open another terminal:



```bash

cd frontend

npm install

npm run dev

```



Open the local URL displayed by Vite in your browser.



\## API Endpoints



| Method | Endpoint | Purpose |

|---|---|---|

| GET | `/` | Backend status |

| POST | `/api/chat` | Process a user query |

| POST | `/api/chat/stream` | Stream chat responses |

| GET | `/api/conversations` | Retrieve conversation history |

| GET | `/api/conversations/{conversation\_id}` | Retrieve a specific conversation |



\## How It Works



1\. The user submits a query through the React frontend.

2\. FastAPI receives the request.

3\. LangGraph executes the multi-agent workflow.

4\. The Research Agent prepares research notes.

5\. The Writer Agent creates a structured draft.

6\. The Reviewer Agent evaluates the draft.

7\. The Validation Agent generates the final answer.

8\. Conversation data is stored in MongoDB Atlas.

9\. The frontend displays the agent outputs.



\## Future Improvements



\- User authentication and authorization

\- Advanced agent collaboration

\- Improved response streaming

\- More robust evaluation and testing

\- Deployment and monitoring



\## Author



\*\*Sushant Kumar\*\*



GitHub: \[Sushant-Kumar333](https://github.com/Sushant-Kumar333)

