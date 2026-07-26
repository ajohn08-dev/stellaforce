-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — FK indexes and RLS for every new table introduced above. RLS follows
-- the same permissive "authenticated full access" pattern as 0004_rls.sql —
-- intentionally coarse, per that migration's documented model.
-- ─────────────────────────────────────────────────────────────────────────────

create index idx_candidate_skills_candidate on candidate_skills(candidate_id);
create index idx_candidate_skills_skill on candidate_skills(skill_id);
create index idx_candidate_tools_candidate on candidate_tools(candidate_id);
create index idx_candidate_tools_tool on candidate_tools(tool_id);
create index idx_candidate_education_candidate on candidate_education(candidate_id);
create index idx_candidate_certifications_candidate on candidate_certifications(candidate_id);
create index idx_candidate_links_candidate on candidate_links(candidate_id);

create index idx_job_notes_job on job_notes(job_id);
create index idx_job_competencies_job on job_competencies(job_id);
create index idx_job_scorecard_categories_job on job_scorecard_categories(job_id);
create index idx_job_team_members_job on job_team_members(job_id);
create index idx_job_team_members_profile on job_team_members(profile_id);
create index idx_job_workflow_sub_stages_job on job_workflow_sub_stages(job_id);
create index idx_job_workflow_sub_stages_pipeline_stage on job_workflow_sub_stages(pipeline_stage_id);
create index idx_job_workflow_sub_stage_details_sub_stage on job_workflow_sub_stage_details(sub_stage_id);
create index idx_job_sub_stage_comps_competency on job_workflow_sub_stage_competencies(competency_id);
create index idx_job_sub_stage_reviewers_member on job_workflow_sub_stage_reviewers(member_id);

create index idx_applications_current_stage on applications(current_stage_id);
create index idx_app_stage_evals_application on application_stage_evaluations(application_id);
create index idx_app_stage_evals_sub_stage on application_stage_evaluations(sub_stage_id);
create index idx_app_stage_evals_interviewer on application_stage_evaluations(interviewer_id);
create index idx_app_stage_eval_notes_evaluation on application_stage_evaluation_notes(evaluation_id);
create index idx_app_sc_categories_category on application_scorecard_categories(category_id);
create index idx_app_sc_competencies_competency on application_scorecard_competencies(competency_id);
create index idx_app_sc_evidence_competency on application_scorecard_evidence(scorecard_competency_id);
create index idx_app_sc_evidence_evaluation on application_scorecard_evidence(evaluation_id);
create index idx_cand_client_fit_evidence_fit on candidate_client_fit_evidence(fit_id);
create index idx_cand_client_fit_evidence_competency on candidate_client_fit_evidence(scorecard_competency_id);

do $$
declare
  tbl text;
  tables text[] := array[
    'skills', 'tools', 'candidate_skills', 'candidate_tools',
    'candidate_work_experiences', 'candidate_education',
    'candidate_certifications', 'candidate_links',
    'job_notes', 'job_competencies', 'job_competency_level_descriptions',
    'job_scorecard_categories', 'job_scorecard_category_competencies',
    'job_team_members', 'pipeline_stages', 'job_workflow_sub_stages',
    'job_workflow_sub_stage_details', 'job_workflow_sub_stage_competencies',
    'job_workflow_sub_stage_reviewers',
    'application_stage_evaluations', 'application_stage_evaluation_notes',
    'application_scorecard_categories', 'application_scorecard_competencies',
    'application_scorecard_evidence', 'candidate_client_fit_evidence'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security;', tbl);
    execute format($f$
      create policy "recruiters_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, tbl);
  end loop;
end $$;
