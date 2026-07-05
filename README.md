<div align="center">
  
# 🌌 CodeScope AI

**The Ultimate Full-Stack Developer Intelligence & Repository Health Platform**

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18+-20232a?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Neo4j-008CC1?style=for-the-badge&logo=neo4j&logoColor=white" alt="Neo4j" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge" alt="Build" />
  <img src="https://img.shields.io/badge/Maintained%3F-yes-brightgreen.svg?style=for-the-badge" alt="Maintained" />
</p>

---

<br/>
<br/>

</div>

## ✨ Executive Summary
CodeScope AI is a premium, enterprise-grade codebase analyzer. It meticulously tracks repository health, indexes complex dependencies, and maps out architectural graphs using Neo4j and a highly responsive React interface. 

Understand your code at a glance, spot technical debt instantly, and visualize your entire project architecture like never before.

---

## 🔥 Key Features

| Feature | Description |
| :--- | :--- |
| 🕸️ **Dependency Intelligence** | Dynamic knowledge graphs built with **React Flow** to explore service relationships and deep code dependencies in real-time. |
| ⚡ **Change Impact Analysis** | Utilizes **Breadth-First Search (BFS)** across Neo4j to calculate the exact downstream impact of any code modification, reducing regression risk. |
| 📊 **Git Analytics Engine** | Parses commit histories to identify code hotspots, detect co-change patterns, and track file lifecycles. |
| 🛡️ **Multi-Tenant Architecture** | Robust, scalable backend utilizing **FastAPI**, **SQLAlchemy**, and **PostgreSQL** with seamless JWT authentication. |

---

## 🚀 Quick Start Guide

We have optimized the setup process so you can get CodeScope AI running locally in under 3 minutes.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Jayanth182004/codescope.git
cd codescope

# Install Frontend
npm install

# Install Backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Duplicate the example environment file and configure your database credentials.
```bash
cp .env.example .env
```
> **Note:** Ensure your PostgreSQL and Neo4j connection strings are correctly mapped in the `.env` file before launching.

### 3. Spin Up the Ecosystem
Deploy the backend and database containers, then start the React dashboard.
```bash
docker-compose up -d  # Bootstraps Postgres, Neo4j, and FastAPI backend
npm run dev           # Ignites the React frontend dashboard
```

🎉 **Success!** Navigate to `http://localhost:5173` to experience CodeScope AI.

---

## 🏗️ Architecture Stack

<details>
<summary><b>Click to expand Architecture Details</b></summary>

- **Frontend:** React, TypeScript, React Flow, Vite
- **Backend:** Python, FastAPI, SQLAlchemy
- **Databases:** PostgreSQL (Relational), Neo4j (Graph Data)
- **DevOps:** Docker, Docker Compose, Pytest, Playwright
</details>

---

<div align="center">
  <i>If you find CodeScope AI valuable, please consider giving it a ⭐️ <b>Star</b>!</i>
</div>
