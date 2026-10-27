from app.core.database import get_database
from app.social.content_plan_runs import ContentPlanRuns
from workers.celery_app import celery_app


@celery_app.task(name="app.social.tasks.planner_runs.generate_planner_run", queue="social_maintenance", max_retries=0)
def generate_planner_run(run_id: str):
    ContentPlanRuns(get_database()).generate(run_id)


@celery_app.task(name="app.social.tasks.planner_runs.recover_planner_runs", queue="social_maintenance", max_retries=0)
def recover_planner_runs():
    from app.social.planner_images import recover

    service = ContentPlanRuns(get_database())
    service.recover()
    recover(service)


@celery_app.task(name="app.social.tasks.planner_runs.generate_planner_image", queue="social_maintenance", max_retries=0)
def generate_planner_image(operation_id: str, generation: str):
    from app.social.planner_images import execute

    execute(ContentPlanRuns(get_database()), operation_id, generation)