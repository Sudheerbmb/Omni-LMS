# LENS-Ω + SN1: Autonomous Evidence-Driven Adaptive Learning Intelligence Layer

**LENS-Ω (Learner Evidence & Neural State Engine)** and **SN1 (Student Neural Intelligence Agent)** provide an enterprise-grade, non-invasive adaptive intelligence layer operating independently on top of the LMS.

---

## 1. System Architecture

```
LMS (System of Record) 
       │ (Learning Events)
       ▼
LMS Integration Adapter ──► Event Gateway / Redis Streams
                                    │
                                    ▼
                          Evidence Normalizer & Processor
                                    │
                                    ▼
                          LENS-Ω State Engine
                   S_t = [M, R, T, MS, C, U, I, V]
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
   Bottleneck Classifier                          Policy Optimizer
(Insuff. Evidence, M, R, T, MS, U)           J(a) = E[U(S_{t+1})] - λCost(a)
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    ▼
                         SN1 LangGraph Agent
             (Diagnose -> Plan -> Validate -> Execute -> Audit)
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                Student Daily Roadmap   Teacher Escalations
```

---

## 2. Core Mathematical Estimators

- **Mastery ($M_t$)**: Calibrated Bayesian state estimation $M_{t+1} = M_t + \alpha_t(y_t - M_t)$
- **Retention ($R_t$)**: Ebbinghaus forgetting curve $R(t) = R_0 \cdot \exp(-\lambda \Delta t)$
- **Transfer ($T_t$)**: Cross-context generalization $T_{t+1} = \alpha T_{obs} + (1-\alpha)T_t$
- **Misconception ($MS_t$)**: Error pattern signal aggregator with decay $MS_{t+1} = MS_t \cdot \gamma$
- **Competency ($C_t$)**: Four-dimensional holistic index $C = [M \cdot R \cdot T \cdot (1 - MS)]^{1/4}$
- **Uncertainty ($U_t$)**: Epistemic variance and evidence density inverse
- **Identifiability ($I_t$)**: $I = \frac{|\text{Observed Required Evidence Types}|}{|\text{Required Evidence Types}|}$
- **Velocity ($V_t$)**: Longitudinal rate of change $\Delta(M, C, T) / \Delta t$

---

## 3. Bottleneck & Learning Mode Mapping

| Detected Bottleneck | Condition | Resolved Mode | Primary Intervention |
| :--- | :--- | :--- | :--- |
| **INSUFFICIENT_EVIDENCE** | $I < 0.50$ | `DIAGNOSTIC` | Diagnostic Baseline Assessment |
| **MASTERY** | Highest gap in $1 - M$ | `ACQUISITION` | Micro-lessons & Worked Examples |
| **RETENTION** | Highest gap in $1 - R$ | `RETRIEVAL` | Spaced Recall & Flash Quizzes |
| **TRANSFER** | Highest gap in $1 - T$ | `TRANSFER` | Cross-context Application Challenges |
| **MISCONCEPTION** | $MS$ signal spiked | `REMEDIATION` | Target Misconception Unlearning |
| **UNCERTAINTY** | High epistemic $U$ | `DIAGNOSTIC` | Broad Sampling Checkpoints |

---

## 4. API Endpoints

- `POST /api/v1/events` &mdash; Ingest and process LMS events
- `POST /api/v1/benchmark/start` & `/response` & `/complete` &mdash; Blueprint-driven diagnostic tests
- `GET /api/v1/students/{id}/state` &mdash; Overall state vector breakdown
- `GET /api/v1/students/{id}/concepts` &mdash; Concept-level mastery & bottleneck matrix
- `GET /api/v1/students/{id}/daily-plan` &mdash; Time-blocked daily roadmap
- `GET /api/v1/students/{id}/exam-readiness` &mdash; Multi-dimensional readiness score
- `POST /api/v1/sn1/chat` &mdash; Grounded student explainability Q&A
- `POST /api/v1/sn1/run` &mdash; Direct LangGraph agent execution

---

## 5. Running the Microservice

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run tests
python -m pytest tests/ -v

# 3. Start LENS-Ω FastAPI Service
uvicorn lens.api.main:app --host 0.0.0.0 --port 8001 --reload

# 4. Deterministic Event Replay
python -m lens.replay.cli --student <STUDENT_UUID>
```
