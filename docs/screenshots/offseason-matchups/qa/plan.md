Frontend 1818700; QA backend ab9b92c533973e43d50a04170963056672fa736b.

Default /matchups must request and visibly show 2026-03-11 with real game rows. Next/previous and reload must preserve selected dates. At phone width, Today must request the current Eastern date and show the offseason empty state; choosing March 11 must restore rows. Invalid date must show backend 400 and visible error; Today and date picker must recover. Capture desktop and phone default slates against QA and separately production. Production is read-only. Automated gates cover loading and rejected requests.
