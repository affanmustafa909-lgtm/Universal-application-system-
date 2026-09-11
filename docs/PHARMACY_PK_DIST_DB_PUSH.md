# Pharmacy PK Dist + Doctor + Theme — DB push notes

After deploying this wave, run against the target Postgres:

```bash
cd backend-system
pnpm db:push
```

New / altered columns & tables:

- `pharmacy_doctor_recommendations`
- `pharmacy_doctor_commission_rules`
- `pharmacy_doctor_commission_entries`
- `pharmacy_routes.sequence_no`, `pharmacy_routes.pjp_day_of_week`
- `pharmacy_visits.is_outstation`
- `pharmacy_wholesale_returns`, `pharmacy_wholesale_return_lines`

Until `db:push` (and API redeploy) complete, doctor CRM prefs/commission and wholesale returns will error on live Railway.
