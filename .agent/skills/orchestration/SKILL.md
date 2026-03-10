---
name: orchestration
description: Protocol for coordinating multiple specialized agents. Enables a master agent to analyze requests, delegate tasks to specialists, and merge results.
---

# 🎼 Orchestration Skill

This skill allows an agent (typically Jarvis) to act as a Master Orchestrator, managing multiple specialized agents in the squad.

## 🧠 Orchestration Protocol

### 1. Request Analysis (Triage)
Before executing, analyze the User's request and identify which domains of expertise are needed:
*   **Copywriting:** Hormozi, Gary Halbert, etc.
*   **Growth/Ads:** Pedro Sobral, Dener Lippert.
*   **Strategy:** Vision, Russell Brunson.
*   **Operations:** Jarvis, Atlas.

### 2. Delegation (The Task Loop)
For each identified domain, create a specific task for the relevant specialist:
*   "Invoque @pedro-sobral para definir a estrutura técnica de anúncios."
*   "Invoque @alex-hormozi para escrever a Headline e o Lead do anúncio."

### 3. Synthesis (The Final Report)
Collect the outputs from all agents and perform a "Copy Chief" review:
*   Ensure consistency in tone.
*   Eliminate contradictions.
*   Format the final output into a cohesive, high-value report for the User.

## 🛠️ Tool Usage
*   Use `parallel-agents` (if available) to run tasks concurrently.
*   Check `.agent/agents/` to see the full list of available specialists before delegating.
