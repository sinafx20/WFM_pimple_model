# Registers the two Windows Scheduled Tasks that run the unattended daily GTM batch.
# Re-run this any time to recreate the tasks (e.g. after moving the repo or changing node).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node).Source
$mainScript = Join-Path $here 'daily-batch.mjs'
$watchdogScript = Join-Path $here 'daily-batch-watchdog.mjs'

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 5)
$days = 'Monday','Tuesday','Wednesday','Thursday','Friday'

$mainAction = New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $mainScript) -WorkingDirectory $here
$mainTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 7:00AM
Register-ScheduledTask -TaskName 'WFM GTM Daily Batch' -Action $mainAction -Trigger $mainTrigger `
  -Settings $settings -Principal $principal -Description 'Generates + writes back + pushes the next 50 GTM contacts every weekday at 7am. Self-deletes (both this task and the watchdog) once the remaining-contacts queue is empty.' -Force | Out-Null

$wdAction = New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $watchdogScript) -WorkingDirectory $here
$wdTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At 8:50AM
Register-ScheduledTask -TaskName 'WFM GTM Daily Batch Watchdog' -Action $wdAction -Trigger $wdTrigger `
  -Settings $settings -Principal $principal -Description 'Alerts by 9am if the 7am GTM batch did not run.' -Force | Out-Null

Write-Output "Registered:"
Get-ScheduledTask -TaskName 'WFM GTM Daily Batch*' | Select-Object TaskName, State
Write-Output ""
Write-Output "Next run times:"
Get-ScheduledTask -TaskName 'WFM GTM Daily Batch*' | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
