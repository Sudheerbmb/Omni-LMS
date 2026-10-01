# LENS-Ω adaptive learning in Omni-LMS

## What is implemented

The application now closes the first useful evidence-to-action loop:

1. Diagnostic, quiz, retrieval, practice, transfer, project, and teacher-observation events enter an immutable evidence stream.
2. Evidence updates a learner/concept state containing mastery, retrievability, transfer, misconception risk, uncertainty, evidence adequacy, and learning velocity.
3. Competency and the current bottleneck are derived rather than independently learned, avoiding contradictory stored values.
4. The policy returns a transparent next action: diagnose, repair, retrieve, generalize, or build.
5. Students see their own model and recommendation. Teachers see only learners in their organizations. Administrators see the platform cohort.
6. Assessment attempts automatically produce quiz evidence. Course-resource completion produces practice evidence, graded assignments produce project/transfer evidence, and evaluated coding submissions produce transfer evidence.
7. A diagnostic/observation form supports initial baselines and teacher judgment.
8. The agent ranks multiple action candidates with explicit expected-gain, effort-cost, uncertainty, and bottleneck-policy terms. These are transparent policy estimates, not causal claims.
9. The dashboard summarizes performance by evidence context, best observed study hour, recurring coded misconceptions, and a five-step priority plan. These are observed behavior patterns and are deliberately not labelled as fixed “learning styles.”

## Scientific interpretation

This is a configurable prototype policy, not a validated cognitive diagnosis. The document's equations combine defensible ideas but their exact coefficients have not been estimated for this population.

- Knowledge tracing supports maintaining a changing estimate from sequential student responses, but predictive accuracy does not prove the estimate corresponds to a unique mental state.
- Item difficulty should eventually be calibrated with an item-response model; the current normalized difficulty is only a bounded content-author input.
- Time decay represents retrievability, while retrieval success strengthens it. A fitted half-life model should replace the shared decay coefficient once longitudinal data exists.
- Transfer must be measured on genuinely different contexts. A transfer tag alone does not demonstrate generalization.
- Misconceptions should eventually come from diagnostic distractors/error categories, not simply low performance.
- Evidence count is not posterior uncertainty. The current metric is called evidence adequacy, not identifiability, and includes evidence-type diversity to reduce false confidence from repetitive items.

## Safety and governance

- The engine is decision support. It must not determine grades, access, discipline, or placement without educator review.
- Raw evidence and derived state remain separate and include a model version so states can be recomputed after calibration.
- Teacher access is organization scoped. Student writes are self-scoped.
- The UI explicitly indicates when evidence is insufficient and recommends measurement instead of making a strong conclusion.

## Recommended evolution

1. Add concept tags, calibrated difficulty/discrimination, diagnostic distractor codes, and prerequisite relationships to assessment questions.
2. Log every recommended action, its selection probability, whether it was accepted, and delayed outcomes (next-day and next-week retrieval plus transfer).
3. Fit and validate parameters using learner-level temporal splits. Report log loss, Brier score, calibration error, decision error, and subgroup calibration; use AUC only as a secondary metric.
4. Validate parameter recovery in simulation, then conduct a teacher-controlled prospective experiment. Synthetic recovery tests code and assumptions, not real-world validity.
5. Only after sufficient logged data, evaluate a conservative contextual bandit offline with propensity-aware or doubly robust estimators. Do not enable unconstrained exploration for learners.
6. Introduce explicit policy constraints for prerequisites, accessibility, workload, age, teacher overrides, and minimum evidence quality before optimizing recommendations.

## API surface

- `POST /api/v1/learning/adaptive/evidence`
- `GET /api/v1/learning/adaptive/me`
- `GET /api/v1/learning/adaptive/students/{student_id}`
- `GET /api/v1/learning/adaptive/cohort`

The adaptive schema is created at startup and checked again on first use, which supports the project's current migration-light Render deployment. Database exceptions are returned as structured, CORS-compatible errors so browser clients do not misreport server failures as generic network failures.

The model version is currently `lens-omega-0.1`.
