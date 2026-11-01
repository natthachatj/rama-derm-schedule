# Cancel approved leave and coverage

As admin, open **Leave requests**, find an approved request, and select **Cancel approved request**. Review the confirmation and select **Confirm cancellation & restore**. This immediately restores the published assignments for that request; no additional publish is needed. The requester and replacement fellows receive in-app notifications. The request remains in history as **cancelled**.

New approvals save the previous published override, effective assignment, and draft override for each session. Cancellation restores those values and keeps unrelated draft edits. If the same draft session has been edited again, that newer draft value stays in place. Workload and extra-cover totals recalculate from the restored plan.

If another approved request or later published edit has changed a requested session, cancellation is blocked for the whole request, with no partial restoration. Cancel later coverage requests first, or review the affected assignments manually. All changes, status updates and notifications share one optimistic revision check and storage write.

Approvals made before snapshots were introduced can also be cancelled. The app warns that it can restore the original requesting fellow, but cannot recover unknown earlier extra-cover flags or overwritten draft values. New approvals preserve these details exactly. Restoration snapshots are included in private admin backups and omitted from fellow/public responses.

# Calendar agendas

Day, week, and month views share morning, afternoon and RAVC sections. In week view, select a day heading to open its agenda. In day and month views, choose **Open day agenda**. Selecting an assignment also shows the full day agenda beneath its details. Fellow, clinic and **My schedule only** filters apply to all agenda sections. Empty sessions remain visible with an appropriate message, including holiday closures. RAVC stays separate and continues on holidays.
