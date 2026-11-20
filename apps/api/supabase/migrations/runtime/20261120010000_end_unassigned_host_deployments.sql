-- An in-flight host deployment with no assignment cannot receive a status
-- report. End it so the environment can accept a new release after assignment.
UPDATE env_provisioning.environment_deployments AS deployment
   SET status = 'failed', detail = 'On-prem host assignment ended.', updated_at = NOW()
 WHERE deployment.delivery = 'host'
   AND deployment.status IN ('pending', 'deploying')
   AND NOT EXISTS (
     SELECT 1 FROM env_provisioning.onprem_hosts AS host
      WHERE host.project_id = deployment.project_id
        AND host.environment_id = deployment.environment_id
        AND host.revoked_at IS NULL
   );
