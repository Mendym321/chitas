// ⚠️ GENERATED FILE — do not edit by hand.
// Source: tools/generate-chumash-data.mjs (Hebcal 5786–5806, Diaspora)
// To update: cd tools && npm run generate

// Shabbos date → parsha learned that week (Sun–Shabbos)
const PARSHA_SCHEDULE = {"2025-09-27":"Vayeilech","2025-10-04":"Haazinu","2025-10-11":"Vezot Haberakhah","2025-10-18":"Bereishit","2025-10-25":"Noach","2025-11-01":"Lech Lecha","2025-11-08":"Vayera","2025-11-15":"Chayei Sara","2025-11-22":"Toldot","2025-11-29":"Vayetzei","2025-12-06":"Vayishlach","2025-12-13":"Vayeshev","2025-12-20":"Miketz","2025-12-27":"Vayigash","2026-01-03":"Vayechi","2026-01-10":"Shemot","2026-01-17":"Vaera","2026-01-24":"Bo","2026-01-31":"Beshalach","2026-02-07":"Yitro","2026-02-14":"Mishpatim","2026-02-21":"Terumah","2026-02-28":"Tetzaveh","2026-03-07":"Ki Tisa","2026-03-14":"Vayakhel-Pekudei","2026-03-21":"Vayikra","2026-03-28":"Tzav","2026-04-04":"Shemini","2026-04-11":"Shemini","2026-04-18":"Tazria-Metzora","2026-04-25":"Acharei Mot-Kedoshim","2026-05-02":"Emor","2026-05-09":"Behar-Bechukotai","2026-05-16":"Bamidbar","2026-05-23":"Nasso","2026-05-30":"Nasso","2026-06-06":"Beha'alotcha","2026-06-13":"Shelach","2026-06-20":"Korach","2026-06-27":"Chukat-Balak","2026-07-04":"Pinchas","2026-07-11":"Matot-Masei","2026-07-18":"Devarim","2026-07-25":"Vaetchanan","2026-08-01":"Eikev","2026-08-08":"Re'eh","2026-08-15":"Shoftim","2026-08-22":"Ki Teitzei","2026-08-29":"Ki Tavo","2026-09-05":"Nitzavim-Vayeilech","2026-09-12":"Haazinu","2026-09-19":"Haazinu","2026-09-26":"Vezot Haberakhah","2026-10-03":"Vezot Haberakhah","2026-10-10":"Bereishit","2026-10-17":"Noach","2026-10-24":"Lech Lecha","2026-10-31":"Vayera","2026-11-07":"Chayei Sara","2026-11-14":"Toldot","2026-11-21":"Vayetzei","2026-11-28":"Vayishlach","2026-12-05":"Vayeshev","2026-12-12":"Miketz","2026-12-19":"Vayigash","2026-12-26":"Vayechi","2027-01-02":"Shemot","2027-01-09":"Vaera","2027-01-16":"Bo","2027-01-23":"Beshalach","2027-01-30":"Yitro","2027-02-06":"Mishpatim","2027-02-13":"Terumah","2027-02-20":"Tetzaveh","2027-02-27":"Ki Tisa","2027-03-06":"Vayakhel","2027-03-13":"Pekudei","2027-03-20":"Vayikra","2027-03-27":"Tzav","2027-04-03":"Shemini","2027-04-10":"Tazria","2027-04-17":"Metzora","2027-04-24":"Acharei Mot","2027-05-01":"Acharei Mot","2027-05-08":"Kedoshim","2027-05-15":"Emor","2027-05-22":"Behar","2027-05-29":"Bechukotai","2027-06-05":"Bamidbar","2027-06-12":"Nasso","2027-06-19":"Nasso","2027-06-26":"Beha'alotcha","2027-07-03":"Shelach","2027-07-10":"Korach","2027-07-17":"Chukat-Balak","2027-07-24":"Pinchas","2027-07-31":"Matot-Masei","2027-08-07":"Devarim","2027-08-14":"Vaetchanan","2027-08-21":"Eikev","2027-08-28":"Re'eh","2027-09-04":"Shoftim","2027-09-11":"Ki Teitzei","2027-09-18":"Ki Tavo","2027-09-25":"Nitzavim-Vayeilech","2027-10-02":"Haazinu","2027-10-09":"Haazinu","2027-10-16":"Vezot Haberakhah","2027-10-23":"Vezot Haberakhah","2027-10-30":"Bereishit","2027-11-06":"Noach","2027-11-13":"Lech Lecha","2027-11-20":"Vayera","2027-11-27":"Chayei Sara","2027-12-04":"Toldot","2027-12-11":"Vayetzei","2027-12-18":"Vayishlach","2027-12-25":"Vayeshev","2028-01-01":"Miketz","2028-01-08":"Vayigash","2028-01-15":"Vayechi","2028-01-22":"Shemot","2028-01-29":"Vaera","2028-02-05":"Bo","2028-02-12":"Beshalach","2028-02-19":"Yitro","2028-02-26":"Mishpatim","2028-03-04":"Terumah","2028-03-11":"Tetzaveh","2028-03-18":"Ki Tisa","2028-03-25":"Vayakhel-Pekudei","2028-04-01":"Vayikra","2028-04-08":"Tzav","2028-04-15":"Shemini","2028-04-22":"Shemini","2028-04-29":"Tazria-Metzora","2028-05-06":"Acharei Mot-Kedoshim","2028-05-13":"Emor","2028-05-20":"Behar-Bechukotai","2028-05-27":"Bamidbar","2028-06-03":"Nasso","2028-06-10":"Beha'alotcha","2028-06-17":"Shelach","2028-06-24":"Korach","2028-07-01":"Chukat","2028-07-08":"Balak","2028-07-15":"Pinchas","2028-07-22":"Matot-Masei","2028-07-29":"Devarim","2028-08-05":"Vaetchanan","2028-08-12":"Eikev","2028-08-19":"Re'eh","2028-08-26":"Shoftim","2028-09-02":"Ki Teitzei","2028-09-09":"Ki Tavo","2028-09-16":"Nitzavim-Vayeilech","2028-09-23":"Haazinu","2028-09-30":"Vezot Haberakhah","2028-10-07":"Vezot Haberakhah","2028-10-14":"Bereishit","2028-10-21":"Noach","2028-10-28":"Lech Lecha","2028-11-04":"Vayera","2028-11-11":"Chayei Sara","2028-11-18":"Toldot","2028-11-25":"Vayetzei","2028-12-02":"Vayishlach","2028-12-09":"Vayeshev","2028-12-16":"Miketz","2028-12-23":"Vayigash","2028-12-30":"Vayechi","2029-01-06":"Shemot","2029-01-13":"Vaera","2029-01-20":"Bo","2029-01-27":"Beshalach","2029-02-03":"Yitro","2029-02-10":"Mishpatim","2029-02-17":"Terumah","2029-02-24":"Tetzaveh","2029-03-03":"Ki Tisa","2029-03-10":"Vayakhel-Pekudei","2029-03-17":"Vayikra","2029-03-24":"Tzav","2029-03-31":"Shemini","2029-04-07":"Shemini","2029-04-14":"Shemini","2029-04-21":"Tazria-Metzora","2029-04-28":"Acharei Mot-Kedoshim","2029-05-05":"Emor","2029-05-12":"Behar-Bechukotai","2029-05-19":"Bamidbar","2029-05-26":"Nasso","2029-06-02":"Beha'alotcha","2029-06-09":"Shelach","2029-06-16":"Korach","2029-06-23":"Chukat","2029-06-30":"Balak","2029-07-07":"Pinchas","2029-07-14":"Matot-Masei","2029-07-21":"Devarim","2029-07-28":"Vaetchanan","2029-08-04":"Eikev","2029-08-11":"Re'eh","2029-08-18":"Shoftim","2029-08-25":"Ki Teitzei","2029-09-01":"Ki Tavo","2029-09-08":"Nitzavim","2029-09-15":"Vayeilech","2029-09-22":"Haazinu","2029-09-29":"Vezot Haberakhah","2029-10-06":"Bereishit","2029-10-13":"Noach","2029-10-20":"Lech Lecha","2029-10-27":"Vayera","2029-11-03":"Chayei Sara","2029-11-10":"Toldot","2029-11-17":"Vayetzei","2029-11-24":"Vayishlach","2029-12-01":"Vayeshev","2029-12-08":"Miketz","2029-12-15":"Vayigash","2029-12-22":"Vayechi","2029-12-29":"Shemot","2030-01-05":"Vaera","2030-01-12":"Bo","2030-01-19":"Beshalach","2030-01-26":"Yitro","2030-02-02":"Mishpatim","2030-02-09":"Terumah","2030-02-16":"Tetzaveh","2030-02-23":"Ki Tisa","2030-03-02":"Vayakhel","2030-03-09":"Pekudei","2030-03-16":"Vayikra","2030-03-23":"Tzav","2030-03-30":"Shemini","2030-04-06":"Tazria","2030-04-13":"Metzora","2030-04-20":"Acharei Mot","2030-04-27":"Acharei Mot","2030-05-04":"Kedoshim","2030-05-11":"Emor","2030-05-18":"Behar","2030-05-25":"Bechukotai","2030-06-01":"Bamidbar","2030-06-08":"Nasso","2030-06-15":"Nasso","2030-06-22":"Beha'alotcha","2030-06-29":"Shelach","2030-07-06":"Korach","2030-07-13":"Chukat-Balak","2030-07-20":"Pinchas","2030-07-27":"Matot-Masei","2030-08-03":"Devarim","2030-08-10":"Vaetchanan","2030-08-17":"Eikev","2030-08-24":"Re'eh","2030-08-31":"Shoftim","2030-09-07":"Ki Teitzei","2030-09-14":"Ki Tavo","2030-09-21":"Nitzavim-Vayeilech","2030-09-28":"Haazinu","2030-10-05":"Haazinu","2030-10-12":"Vezot Haberakhah","2030-10-19":"Vezot Haberakhah","2030-10-26":"Bereishit","2030-11-02":"Noach","2030-11-09":"Lech Lecha","2030-11-16":"Vayera","2030-11-23":"Chayei Sara","2030-11-30":"Toldot","2030-12-07":"Vayetzei","2030-12-14":"Vayishlach","2030-12-21":"Vayeshev","2030-12-28":"Miketz","2031-01-04":"Vayigash","2031-01-11":"Vayechi","2031-01-18":"Shemot","2031-01-25":"Vaera","2031-02-01":"Bo","2031-02-08":"Beshalach","2031-02-15":"Yitro","2031-02-22":"Mishpatim","2031-03-01":"Terumah","2031-03-08":"Tetzaveh","2031-03-15":"Ki Tisa","2031-03-22":"Vayakhel-Pekudei","2031-03-29":"Vayikra","2031-04-05":"Tzav","2031-04-12":"Shemini","2031-04-19":"Shemini","2031-04-26":"Tazria-Metzora","2031-05-03":"Acharei Mot-Kedoshim","2031-05-10":"Emor","2031-05-17":"Behar-Bechukotai","2031-05-24":"Bamidbar","2031-05-31":"Nasso","2031-06-07":"Beha'alotcha","2031-06-14":"Shelach","2031-06-21":"Korach","2031-06-28":"Chukat","2031-07-05":"Balak","2031-07-12":"Pinchas","2031-07-19":"Matot-Masei","2031-07-26":"Devarim","2031-08-02":"Vaetchanan","2031-08-09":"Eikev","2031-08-16":"Re'eh","2031-08-23":"Shoftim","2031-08-30":"Ki Teitzei","2031-09-06":"Ki Tavo","2031-09-13":"Nitzavim-Vayeilech","2031-09-20":"Haazinu","2031-09-27":"Vezot Haberakhah","2031-10-04":"Vezot Haberakhah","2031-10-11":"Bereishit","2031-10-18":"Noach","2031-10-25":"Lech Lecha","2031-11-01":"Vayera","2031-11-08":"Chayei Sara","2031-11-15":"Toldot","2031-11-22":"Vayetzei","2031-11-29":"Vayishlach","2031-12-06":"Vayeshev","2031-12-13":"Miketz","2031-12-20":"Vayigash","2031-12-27":"Vayechi","2032-01-03":"Shemot","2032-01-10":"Vaera","2032-01-17":"Bo","2032-01-24":"Beshalach","2032-01-31":"Yitro","2032-02-07":"Mishpatim","2032-02-14":"Terumah","2032-02-21":"Tetzaveh","2032-02-28":"Ki Tisa","2032-03-06":"Vayakhel-Pekudei","2032-03-13":"Vayikra","2032-03-20":"Tzav","2032-03-27":"Shemini","2032-04-03":"Shemini","2032-04-10":"Shemini","2032-04-17":"Tazria-Metzora","2032-04-24":"Acharei Mot-Kedoshim","2032-05-01":"Emor","2032-05-08":"Behar-Bechukotai","2032-05-15":"Bamidbar","2032-05-22":"Nasso","2032-05-29":"Beha'alotcha","2032-06-05":"Shelach","2032-06-12":"Korach","2032-06-19":"Chukat","2032-06-26":"Balak","2032-07-03":"Pinchas","2032-07-10":"Matot-Masei","2032-07-17":"Devarim","2032-07-24":"Vaetchanan","2032-07-31":"Eikev","2032-08-07":"Re'eh","2032-08-14":"Shoftim","2032-08-21":"Ki Teitzei","2032-08-28":"Ki Tavo","2032-09-04":"Nitzavim","2032-09-11":"Vayeilech","2032-09-18":"Haazinu","2032-09-25":"Vezot Haberakhah","2032-10-02":"Bereishit","2032-10-09":"Noach","2032-10-16":"Lech Lecha","2032-10-23":"Vayera","2032-10-30":"Chayei Sara","2032-11-06":"Toldot","2032-11-13":"Vayetzei","2032-11-20":"Vayishlach","2032-11-27":"Vayeshev","2032-12-04":"Miketz","2032-12-11":"Vayigash","2032-12-18":"Vayechi","2032-12-25":"Shemot","2033-01-01":"Vaera","2033-01-08":"Bo","2033-01-15":"Beshalach","2033-01-22":"Yitro","2033-01-29":"Mishpatim","2033-02-05":"Terumah","2033-02-12":"Tetzaveh","2033-02-19":"Ki Tisa","2033-02-26":"Vayakhel","2033-03-05":"Pekudei","2033-03-12":"Vayikra","2033-03-19":"Tzav","2033-03-26":"Shemini","2033-04-02":"Tazria","2033-04-09":"Metzora","2033-04-16":"Acharei Mot","2033-04-23":"Acharei Mot","2033-04-30":"Kedoshim","2033-05-07":"Emor","2033-05-14":"Behar","2033-05-21":"Bechukotai","2033-05-28":"Bamidbar","2033-06-04":"Nasso","2033-06-11":"Nasso","2033-06-18":"Beha'alotcha","2033-06-25":"Shelach","2033-07-02":"Korach","2033-07-09":"Chukat-Balak","2033-07-16":"Pinchas","2033-07-23":"Matot-Masei","2033-07-30":"Devarim","2033-08-06":"Vaetchanan","2033-08-13":"Eikev","2033-08-20":"Re'eh","2033-08-27":"Shoftim","2033-09-03":"Ki Teitzei","2033-09-10":"Ki Tavo","2033-09-17":"Nitzavim-Vayeilech","2033-09-24":"Haazinu","2033-10-01":"Haazinu","2033-10-08":"Vezot Haberakhah","2033-10-15":"Vezot Haberakhah","2033-10-22":"Bereishit","2033-10-29":"Noach","2033-11-05":"Lech Lecha","2033-11-12":"Vayera","2033-11-19":"Chayei Sara","2033-11-26":"Toldot","2033-12-03":"Vayetzei","2033-12-10":"Vayishlach","2033-12-17":"Vayeshev","2033-12-24":"Miketz","2033-12-31":"Vayigash","2034-01-07":"Vayechi","2034-01-14":"Shemot","2034-01-21":"Vaera","2034-01-28":"Bo","2034-02-04":"Beshalach","2034-02-11":"Yitro","2034-02-18":"Mishpatim","2034-02-25":"Terumah","2034-03-04":"Tetzaveh","2034-03-11":"Ki Tisa","2034-03-18":"Vayakhel-Pekudei","2034-03-25":"Vayikra","2034-04-01":"Tzav","2034-04-08":"Shemini","2034-04-15":"Shemini","2034-04-22":"Tazria-Metzora","2034-04-29":"Acharei Mot-Kedoshim","2034-05-06":"Emor","2034-05-13":"Behar-Bechukotai","2034-05-20":"Bamidbar","2034-05-27":"Nasso","2034-06-03":"Beha'alotcha","2034-06-10":"Shelach","2034-06-17":"Korach","2034-06-24":"Chukat","2034-07-01":"Balak","2034-07-08":"Pinchas","2034-07-15":"Matot-Masei","2034-07-22":"Devarim","2034-07-29":"Vaetchanan","2034-08-05":"Eikev","2034-08-12":"Re'eh","2034-08-19":"Shoftim","2034-08-26":"Ki Teitzei","2034-09-02":"Ki Tavo","2034-09-09":"Nitzavim-Vayeilech","2034-09-16":"Haazinu","2034-09-23":"Vezot Haberakhah","2034-09-30":"Vezot Haberakhah","2034-10-07":"Bereishit","2034-10-14":"Noach","2034-10-21":"Lech Lecha","2034-10-28":"Vayera","2034-11-04":"Chayei Sara","2034-11-11":"Toldot","2034-11-18":"Vayetzei","2034-11-25":"Vayishlach","2034-12-02":"Vayeshev","2034-12-09":"Miketz","2034-12-16":"Vayigash","2034-12-23":"Vayechi","2034-12-30":"Shemot","2035-01-06":"Vaera","2035-01-13":"Bo","2035-01-20":"Beshalach","2035-01-27":"Yitro","2035-02-03":"Mishpatim","2035-02-10":"Terumah","2035-02-17":"Tetzaveh","2035-02-24":"Ki Tisa","2035-03-03":"Vayakhel","2035-03-10":"Pekudei","2035-03-17":"Vayikra","2035-03-24":"Tzav","2035-03-31":"Shemini","2035-04-07":"Tazria","2035-04-14":"Metzora","2035-04-21":"Acharei Mot","2035-04-28":"Kedoshim","2035-05-05":"Kedoshim","2035-05-12":"Emor","2035-05-19":"Behar","2035-05-26":"Bechukotai","2035-06-02":"Bamidbar","2035-06-09":"Nasso","2035-06-16":"Beha'alotcha","2035-06-23":"Shelach","2035-06-30":"Korach","2035-07-07":"Chukat","2035-07-14":"Balak","2035-07-21":"Pinchas","2035-07-28":"Matot","2035-08-04":"Masei","2035-08-11":"Devarim","2035-08-18":"Vaetchanan","2035-08-25":"Eikev","2035-09-01":"Re'eh","2035-09-08":"Shoftim","2035-09-15":"Ki Teitzei","2035-09-22":"Ki Tavo","2035-09-29":"Nitzavim-Vayeilech","2035-10-06":"Haazinu","2035-10-13":"Vezot Haberakhah","2035-10-20":"Vezot Haberakhah","2035-10-27":"Bereishit","2035-11-03":"Noach","2035-11-10":"Lech Lecha","2035-11-17":"Vayera","2035-11-24":"Chayei Sara","2035-12-01":"Toldot","2035-12-08":"Vayetzei","2035-12-15":"Vayishlach","2035-12-22":"Vayeshev","2035-12-29":"Miketz","2036-01-05":"Vayigash","2036-01-12":"Vayechi","2036-01-19":"Shemot","2036-01-26":"Vaera","2036-02-02":"Bo","2036-02-09":"Beshalach","2036-02-16":"Yitro","2036-02-23":"Mishpatim","2036-03-01":"Terumah","2036-03-08":"Tetzaveh","2036-03-15":"Ki Tisa","2036-03-22":"Vayakhel-Pekudei","2036-03-29":"Vayikra","2036-04-05":"Tzav","2036-04-12":"Shemini","2036-04-19":"Shemini","2036-04-26":"Shemini","2036-05-03":"Tazria-Metzora","2036-05-10":"Acharei Mot-Kedoshim","2036-05-17":"Emor","2036-05-24":"Behar-Bechukotai","2036-05-31":"Bamidbar","2036-06-07":"Nasso","2036-06-14":"Beha'alotcha","2036-06-21":"Shelach","2036-06-28":"Korach","2036-07-05":"Chukat","2036-07-12":"Balak","2036-07-19":"Pinchas","2036-07-26":"Matot-Masei","2036-08-02":"Devarim","2036-08-09":"Vaetchanan","2036-08-16":"Eikev","2036-08-23":"Re'eh","2036-08-30":"Shoftim","2036-09-06":"Ki Teitzei","2036-09-13":"Ki Tavo","2036-09-20":"Nitzavim","2036-09-27":"Vayeilech","2036-10-04":"Haazinu","2036-10-11":"Vezot Haberakhah","2036-10-18":"Bereishit","2036-10-25":"Noach","2036-11-01":"Lech Lecha","2036-11-08":"Vayera","2036-11-15":"Chayei Sara","2036-11-22":"Toldot","2036-11-29":"Vayetzei","2036-12-06":"Vayishlach","2036-12-13":"Vayeshev","2036-12-20":"Miketz","2036-12-27":"Vayigash","2037-01-03":"Vayechi","2037-01-10":"Shemot","2037-01-17":"Vaera","2037-01-24":"Bo","2037-01-31":"Beshalach","2037-02-07":"Yitro","2037-02-14":"Mishpatim","2037-02-21":"Terumah","2037-02-28":"Tetzaveh","2037-03-07":"Ki Tisa","2037-03-14":"Vayakhel-Pekudei","2037-03-21":"Vayikra","2037-03-28":"Tzav","2037-04-04":"Shemini","2037-04-11":"Shemini","2037-04-18":"Tazria-Metzora","2037-04-25":"Acharei Mot-Kedoshim","2037-05-02":"Emor","2037-05-09":"Behar-Bechukotai","2037-05-16":"Bamidbar","2037-05-23":"Nasso","2037-05-30":"Beha'alotcha","2037-06-06":"Shelach","2037-06-13":"Korach","2037-06-20":"Chukat","2037-06-27":"Balak","2037-07-04":"Pinchas","2037-07-11":"Matot-Masei","2037-07-18":"Devarim","2037-07-25":"Vaetchanan","2037-08-01":"Eikev","2037-08-08":"Re'eh","2037-08-15":"Shoftim","2037-08-22":"Ki Teitzei","2037-08-29":"Ki Tavo","2037-09-05":"Nitzavim-Vayeilech","2037-09-12":"Haazinu","2037-09-19":"Vezot Haberakhah","2037-09-26":"Vezot Haberakhah","2037-10-03":"Bereishit","2037-10-10":"Noach","2037-10-17":"Lech Lecha","2037-10-24":"Vayera","2037-10-31":"Chayei Sara","2037-11-07":"Toldot","2037-11-14":"Vayetzei","2037-11-21":"Vayishlach","2037-11-28":"Vayeshev","2037-12-05":"Miketz","2037-12-12":"Vayigash","2037-12-19":"Vayechi","2037-12-26":"Shemot","2038-01-02":"Vaera","2038-01-09":"Bo","2038-01-16":"Beshalach","2038-01-23":"Yitro","2038-01-30":"Mishpatim","2038-02-06":"Terumah","2038-02-13":"Tetzaveh","2038-02-20":"Ki Tisa","2038-02-27":"Vayakhel","2038-03-06":"Pekudei","2038-03-13":"Vayikra","2038-03-20":"Tzav","2038-03-27":"Shemini","2038-04-03":"Tazria","2038-04-10":"Metzora","2038-04-17":"Acharei Mot","2038-04-24":"Kedoshim","2038-05-01":"Kedoshim","2038-05-08":"Emor","2038-05-15":"Behar","2038-05-22":"Bechukotai","2038-05-29":"Bamidbar","2038-06-05":"Nasso","2038-06-12":"Beha'alotcha","2038-06-19":"Shelach","2038-06-26":"Korach","2038-07-03":"Chukat","2038-07-10":"Balak","2038-07-17":"Pinchas","2038-07-24":"Matot","2038-07-31":"Masei","2038-08-07":"Devarim","2038-08-14":"Vaetchanan","2038-08-21":"Eikev","2038-08-28":"Re'eh","2038-09-04":"Shoftim","2038-09-11":"Ki Teitzei","2038-09-18":"Ki Tavo","2038-09-25":"Nitzavim-Vayeilech","2038-10-02":"Haazinu","2038-10-09":"Vezot Haberakhah","2038-10-16":"Vezot Haberakhah","2038-10-23":"Bereishit","2038-10-30":"Noach","2038-11-06":"Lech Lecha","2038-11-13":"Vayera","2038-11-20":"Chayei Sara","2038-11-27":"Toldot","2038-12-04":"Vayetzei","2038-12-11":"Vayishlach","2038-12-18":"Vayeshev","2038-12-25":"Miketz","2039-01-01":"Vayigash","2039-01-08":"Vayechi","2039-01-15":"Shemot","2039-01-22":"Vaera","2039-01-29":"Bo","2039-02-05":"Beshalach","2039-02-12":"Yitro","2039-02-19":"Mishpatim","2039-02-26":"Terumah","2039-03-05":"Tetzaveh","2039-03-12":"Ki Tisa","2039-03-19":"Vayakhel-Pekudei","2039-03-26":"Vayikra","2039-04-02":"Tzav","2039-04-09":"Shemini","2039-04-16":"Shemini","2039-04-23":"Shemini","2039-04-30":"Tazria-Metzora","2039-05-07":"Acharei Mot-Kedoshim","2039-05-14":"Emor","2039-05-21":"Behar-Bechukotai","2039-05-28":"Bamidbar","2039-06-04":"Nasso","2039-06-11":"Beha'alotcha","2039-06-18":"Shelach","2039-06-25":"Korach","2039-07-02":"Chukat","2039-07-09":"Balak","2039-07-16":"Pinchas","2039-07-23":"Matot-Masei","2039-07-30":"Devarim","2039-08-06":"Vaetchanan","2039-08-13":"Eikev","2039-08-20":"Re'eh","2039-08-27":"Shoftim","2039-09-03":"Ki Teitzei","2039-09-10":"Ki Tavo","2039-09-17":"Nitzavim","2039-09-24":"Vayeilech","2039-10-01":"Haazinu","2039-10-08":"Vezot Haberakhah","2039-10-15":"Bereishit","2039-10-22":"Noach","2039-10-29":"Lech Lecha","2039-11-05":"Vayera","2039-11-12":"Chayei Sara","2039-11-19":"Toldot","2039-11-26":"Vayetzei","2039-12-03":"Vayishlach","2039-12-10":"Vayeshev","2039-12-17":"Miketz","2039-12-24":"Vayigash","2039-12-31":"Vayechi","2040-01-07":"Shemot","2040-01-14":"Vaera","2040-01-21":"Bo","2040-01-28":"Beshalach","2040-02-04":"Yitro","2040-02-11":"Mishpatim","2040-02-18":"Terumah","2040-02-25":"Tetzaveh","2040-03-03":"Ki Tisa","2040-03-10":"Vayakhel-Pekudei","2040-03-17":"Vayikra","2040-03-24":"Tzav","2040-03-31":"Shemini","2040-04-07":"Shemini","2040-04-14":"Tazria-Metzora","2040-04-21":"Acharei Mot-Kedoshim","2040-04-28":"Emor","2040-05-05":"Behar-Bechukotai","2040-05-12":"Bamidbar","2040-05-19":"Nasso","2040-05-26":"Nasso","2040-06-02":"Beha'alotcha","2040-06-09":"Shelach","2040-06-16":"Korach","2040-06-23":"Chukat-Balak","2040-06-30":"Pinchas","2040-07-07":"Matot-Masei","2040-07-14":"Devarim","2040-07-21":"Vaetchanan","2040-07-28":"Eikev","2040-08-04":"Re'eh","2040-08-11":"Shoftim","2040-08-18":"Ki Teitzei","2040-08-25":"Ki Tavo","2040-09-01":"Nitzavim-Vayeilech","2040-09-08":"Haazinu","2040-09-15":"Haazinu","2040-09-22":"Vezot Haberakhah","2040-09-29":"Vezot Haberakhah","2040-10-06":"Bereishit","2040-10-13":"Noach","2040-10-20":"Lech Lecha","2040-10-27":"Vayera","2040-11-03":"Chayei Sara","2040-11-10":"Toldot","2040-11-17":"Vayetzei","2040-11-24":"Vayishlach","2040-12-01":"Vayeshev","2040-12-08":"Miketz","2040-12-15":"Vayigash","2040-12-22":"Vayechi","2040-12-29":"Shemot","2041-01-05":"Vaera","2041-01-12":"Bo","2041-01-19":"Beshalach","2041-01-26":"Yitro","2041-02-02":"Mishpatim","2041-02-09":"Terumah","2041-02-16":"Tetzaveh","2041-02-23":"Ki Tisa","2041-03-02":"Vayakhel","2041-03-09":"Pekudei","2041-03-16":"Vayikra","2041-03-23":"Tzav","2041-03-30":"Shemini","2041-04-06":"Tazria","2041-04-13":"Metzora","2041-04-20":"Acharei Mot","2041-04-27":"Acharei Mot","2041-05-04":"Kedoshim","2041-05-11":"Emor","2041-05-18":"Behar","2041-05-25":"Bechukotai","2041-06-01":"Bamidbar","2041-06-08":"Nasso","2041-06-15":"Beha'alotcha","2041-06-22":"Shelach","2041-06-29":"Korach","2041-07-06":"Chukat","2041-07-13":"Balak","2041-07-20":"Pinchas","2041-07-27":"Matot-Masei","2041-08-03":"Devarim","2041-08-10":"Vaetchanan","2041-08-17":"Eikev","2041-08-24":"Re'eh","2041-08-31":"Shoftim","2041-09-07":"Ki Teitzei","2041-09-14":"Ki Tavo","2041-09-21":"Nitzavim-Vayeilech","2041-09-28":"Haazinu","2041-10-05":"Vezot Haberakhah","2041-10-12":"Vezot Haberakhah","2041-10-19":"Bereishit","2041-10-26":"Noach","2041-11-02":"Lech Lecha","2041-11-09":"Vayera","2041-11-16":"Chayei Sara","2041-11-23":"Toldot","2041-11-30":"Vayetzei","2041-12-07":"Vayishlach","2041-12-14":"Vayeshev","2041-12-21":"Miketz","2041-12-28":"Vayigash","2042-01-04":"Vayechi","2042-01-11":"Shemot","2042-01-18":"Vaera","2042-01-25":"Bo","2042-02-01":"Beshalach","2042-02-08":"Yitro","2042-02-15":"Mishpatim","2042-02-22":"Terumah","2042-03-01":"Tetzaveh","2042-03-08":"Ki Tisa","2042-03-15":"Vayakhel-Pekudei","2042-03-22":"Vayikra","2042-03-29":"Tzav","2042-04-05":"Shemini","2042-04-12":"Shemini","2042-04-19":"Shemini","2042-04-26":"Tazria-Metzora","2042-05-03":"Acharei Mot-Kedoshim","2042-05-10":"Emor","2042-05-17":"Behar-Bechukotai","2042-05-24":"Bamidbar","2042-05-31":"Nasso","2042-06-07":"Beha'alotcha","2042-06-14":"Shelach","2042-06-21":"Korach","2042-06-28":"Chukat","2042-07-05":"Balak","2042-07-12":"Pinchas","2042-07-19":"Matot-Masei","2042-07-26":"Devarim","2042-08-02":"Vaetchanan","2042-08-09":"Eikev","2042-08-16":"Re'eh","2042-08-23":"Shoftim","2042-08-30":"Ki Teitzei","2042-09-06":"Ki Tavo","2042-09-13":"Nitzavim","2042-09-20":"Vayeilech","2042-09-27":"Haazinu","2042-10-04":"Vezot Haberakhah","2042-10-11":"Bereishit","2042-10-18":"Noach","2042-10-25":"Lech Lecha","2042-11-01":"Vayera","2042-11-08":"Chayei Sara","2042-11-15":"Toldot","2042-11-22":"Vayetzei","2042-11-29":"Vayishlach","2042-12-06":"Vayeshev","2042-12-13":"Miketz","2042-12-20":"Vayigash","2042-12-27":"Vayechi","2043-01-03":"Shemot","2043-01-10":"Vaera","2043-01-17":"Bo","2043-01-24":"Beshalach","2043-01-31":"Yitro","2043-02-07":"Mishpatim","2043-02-14":"Terumah","2043-02-21":"Tetzaveh","2043-02-28":"Ki Tisa","2043-03-07":"Vayakhel","2043-03-14":"Pekudei","2043-03-21":"Vayikra","2043-03-28":"Tzav","2043-04-04":"Shemini","2043-04-11":"Tazria","2043-04-18":"Metzora","2043-04-25":"Acharei Mot","2043-05-02":"Acharei Mot","2043-05-09":"Acharei Mot","2043-05-16":"Kedoshim","2043-05-23":"Emor","2043-05-30":"Behar","2043-06-06":"Bechukotai","2043-06-13":"Bamidbar","2043-06-20":"Nasso","2043-06-27":"Beha'alotcha","2043-07-04":"Shelach","2043-07-11":"Korach","2043-07-18":"Chukat","2043-07-25":"Balak","2043-08-01":"Pinchas","2043-08-08":"Matot-Masei","2043-08-15":"Devarim","2043-08-22":"Vaetchanan","2043-08-29":"Eikev","2043-09-05":"Re'eh","2043-09-12":"Shoftim","2043-09-19":"Ki Teitzei","2043-09-26":"Ki Tavo","2043-10-03":"Nitzavim","2043-10-10":"Vayeilech","2043-10-17":"Haazinu","2043-10-24":"Vezot Haberakhah","2043-10-31":"Bereishit","2043-11-07":"Noach","2043-11-14":"Lech Lecha","2043-11-21":"Vayera","2043-11-28":"Chayei Sara","2043-12-05":"Toldot","2043-12-12":"Vayetzei","2043-12-19":"Vayishlach","2043-12-26":"Vayeshev","2044-01-02":"Miketz","2044-01-09":"Vayigash","2044-01-16":"Vayechi","2044-01-23":"Shemot","2044-01-30":"Vaera","2044-02-06":"Bo","2044-02-13":"Beshalach","2044-02-20":"Yitro","2044-02-27":"Mishpatim","2044-03-05":"Terumah","2044-03-12":"Tetzaveh","2044-03-19":"Ki Tisa","2044-03-26":"Vayakhel-Pekudei","2044-04-02":"Vayikra","2044-04-09":"Tzav","2044-04-16":"Shemini","2044-04-23":"Shemini","2044-04-30":"Tazria-Metzora","2044-05-07":"Acharei Mot-Kedoshim","2044-05-14":"Emor","2044-05-21":"Behar-Bechukotai","2044-05-28":"Bamidbar","2044-06-04":"Nasso","2044-06-11":"Beha'alotcha","2044-06-18":"Shelach","2044-06-25":"Korach","2044-07-02":"Chukat","2044-07-09":"Balak","2044-07-16":"Pinchas","2044-07-23":"Matot-Masei","2044-07-30":"Devarim","2044-08-06":"Vaetchanan","2044-08-13":"Eikev","2044-08-20":"Re'eh","2044-08-27":"Shoftim","2044-09-03":"Ki Teitzei","2044-09-10":"Ki Tavo","2044-09-17":"Nitzavim-Vayeilech","2044-09-24":"Haazinu","2044-10-01":"Vezot Haberakhah","2044-10-08":"Vezot Haberakhah","2044-10-15":"Bereishit","2044-10-22":"Noach","2044-10-29":"Lech Lecha","2044-11-05":"Vayera","2044-11-12":"Chayei Sara","2044-11-19":"Toldot","2044-11-26":"Vayetzei","2044-12-03":"Vayishlach","2044-12-10":"Vayeshev","2044-12-17":"Miketz","2044-12-24":"Vayigash","2044-12-31":"Vayechi","2045-01-07":"Shemot","2045-01-14":"Vaera","2045-01-21":"Bo","2045-01-28":"Beshalach","2045-02-04":"Yitro","2045-02-11":"Mishpatim","2045-02-18":"Terumah","2045-02-25":"Tetzaveh","2045-03-04":"Ki Tisa","2045-03-11":"Vayakhel","2045-03-18":"Pekudei","2045-03-25":"Vayikra","2045-04-01":"Tzav","2045-04-08":"Shemini","2045-04-15":"Shemini","2045-04-22":"Tazria-Metzora","2045-04-29":"Acharei Mot-Kedoshim","2045-05-06":"Emor","2045-05-13":"Behar-Bechukotai","2045-05-20":"Bamidbar","2045-05-27":"Nasso","2045-06-03":"Beha'alotcha","2045-06-10":"Shelach","2045-06-17":"Korach","2045-06-24":"Chukat","2045-07-01":"Balak","2045-07-08":"Pinchas","2045-07-15":"Matot-Masei","2045-07-22":"Devarim","2045-07-29":"Vaetchanan","2045-08-05":"Eikev","2045-08-12":"Re'eh","2045-08-19":"Shoftim","2045-08-26":"Ki Teitzei","2045-09-02":"Ki Tavo","2045-09-09":"Nitzavim","2045-09-16":"Vayeilech","2045-09-23":"Haazinu","2045-09-30":"Vezot Haberakhah","2045-10-07":"Bereishit","2045-10-14":"Noach","2045-10-21":"Lech Lecha","2045-10-28":"Vayera","2045-11-04":"Chayei Sara","2045-11-11":"Toldot","2045-11-18":"Vayetzei","2045-11-25":"Vayishlach","2045-12-02":"Vayeshev","2045-12-09":"Miketz","2045-12-16":"Vayigash","2045-12-23":"Vayechi","2045-12-30":"Shemot","2046-01-06":"Vaera","2046-01-13":"Bo","2046-01-20":"Beshalach","2046-01-27":"Yitro","2046-02-03":"Mishpatim","2046-02-10":"Terumah","2046-02-17":"Tetzaveh","2046-02-24":"Ki Tisa","2046-03-03":"Vayakhel","2046-03-10":"Pekudei","2046-03-17":"Vayikra","2046-03-24":"Tzav","2046-03-31":"Shemini","2046-04-07":"Tazria","2046-04-14":"Metzora","2046-04-21":"Acharei Mot","2046-04-28":"Acharei Mot","2046-05-05":"Acharei Mot","2046-05-12":"Kedoshim","2046-05-19":"Emor","2046-05-26":"Behar","2046-06-02":"Bechukotai","2046-06-09":"Bamidbar","2046-06-16":"Nasso","2046-06-23":"Beha'alotcha","2046-06-30":"Shelach","2046-07-07":"Korach","2046-07-14":"Chukat","2046-07-21":"Balak","2046-07-28":"Pinchas","2046-08-04":"Matot-Masei","2046-08-11":"Devarim","2046-08-18":"Vaetchanan","2046-08-25":"Eikev","2046-09-01":"Re'eh","2046-09-08":"Shoftim","2046-09-15":"Ki Teitzei","2046-09-22":"Ki Tavo","2046-09-29":"Nitzavim"};

// Parsha → 7 aliyos (index 0 = Sunday … index 6 = Shabbos)
const PARSHA_ALIYOT = {
 "Vayeilech": [
  "Deuteronomy 31:1-31:3",
  "Deuteronomy 31:4-31:6",
  "Deuteronomy 31:7-31:9",
  "Deuteronomy 31:10-31:13",
  "Deuteronomy 31:14-31:19",
  "Deuteronomy 31:20-31:24",
  "Deuteronomy 31:25-31:30"
 ],
 "Haazinu": [
  "Deuteronomy 32:1-32:6",
  "Deuteronomy 32:7-32:12",
  "Deuteronomy 32:13-32:18",
  "Deuteronomy 32:19-32:28",
  "Deuteronomy 32:29-32:39",
  "Deuteronomy 32:40-32:43",
  "Deuteronomy 32:44-32:52"
 ],
 "Bereishit": [
  "Genesis 1:1-2:3",
  "Genesis 2:4-2:19",
  "Genesis 2:20-3:21",
  "Genesis 3:22-4:18",
  "Genesis 4:19-4:22",
  "Genesis 4:23-5:24",
  "Genesis 5:25-6:8"
 ],
 "Noach": [
  "Genesis 6:9-6:22",
  "Genesis 7:1-7:16",
  "Genesis 7:17-8:14",
  "Genesis 8:15-9:7",
  "Genesis 9:8-9:17",
  "Genesis 9:18-10:32",
  "Genesis 11:1-11:32"
 ],
 "Lech Lecha": [
  "Genesis 12:1-12:13",
  "Genesis 12:14-13:4",
  "Genesis 13:5-13:18",
  "Genesis 14:1-14:20",
  "Genesis 14:21-15:6",
  "Genesis 15:7-17:6",
  "Genesis 17:7-17:27"
 ],
 "Vayera": [
  "Genesis 18:1-18:14",
  "Genesis 18:15-18:33",
  "Genesis 19:1-19:20",
  "Genesis 19:21-21:4",
  "Genesis 21:5-21:21",
  "Genesis 21:22-21:34",
  "Genesis 22:1-22:24"
 ],
 "Chayei Sara": [
  "Genesis 23:1-23:16",
  "Genesis 23:17-24:9",
  "Genesis 24:10-24:26",
  "Genesis 24:27-24:52",
  "Genesis 24:53-24:67",
  "Genesis 25:1-25:11",
  "Genesis 25:12-25:18"
 ],
 "Toldot": [
  "Genesis 25:19-26:5",
  "Genesis 26:6-26:12",
  "Genesis 26:13-26:22",
  "Genesis 26:23-26:29",
  "Genesis 26:30-27:27",
  "Genesis 27:28-28:4",
  "Genesis 28:5-28:9"
 ],
 "Vayetzei": [
  "Genesis 28:10-28:22",
  "Genesis 29:1-29:17",
  "Genesis 29:18-30:13",
  "Genesis 30:14-30:27",
  "Genesis 30:28-31:16",
  "Genesis 31:17-31:42",
  "Genesis 31:43-32:3"
 ],
 "Vayishlach": [
  "Genesis 32:4-32:13",
  "Genesis 32:14-32:30",
  "Genesis 32:31-33:5",
  "Genesis 33:6-33:20",
  "Genesis 34:1-35:11",
  "Genesis 35:12-36:19",
  "Genesis 36:20-36:43"
 ],
 "Vayeshev": [
  "Genesis 37:1-37:11",
  "Genesis 37:12-37:22",
  "Genesis 37:23-37:36",
  "Genesis 38:1-38:30",
  "Genesis 39:1-39:6",
  "Genesis 39:7-39:23",
  "Genesis 40:1-40:23"
 ],
 "Miketz": [
  "Genesis 41:1-41:14",
  "Genesis 41:15-41:38",
  "Genesis 41:39-41:52",
  "Genesis 41:53-42:18",
  "Genesis 42:19-43:15",
  "Genesis 43:16-43:29",
  "Genesis 43:30-44:17"
 ],
 "Vayigash": [
  "Genesis 44:18-44:30",
  "Genesis 44:31-45:7",
  "Genesis 45:8-45:18",
  "Genesis 45:19-45:27",
  "Genesis 45:28-46:27",
  "Genesis 46:28-47:10",
  "Genesis 47:11-47:27"
 ],
 "Vayechi": [
  "Genesis 47:28-48:9",
  "Genesis 48:10-48:16",
  "Genesis 48:17-48:22",
  "Genesis 49:1-49:18",
  "Genesis 49:19-49:26",
  "Genesis 49:27-50:20",
  "Genesis 50:21-50:26"
 ],
 "Shemot": [
  "Exodus 1:1-1:17",
  "Exodus 1:18-2:10",
  "Exodus 2:11-2:25",
  "Exodus 3:1-3:15",
  "Exodus 3:16-4:17",
  "Exodus 4:18-4:31",
  "Exodus 5:1-6:1"
 ],
 "Vaera": [
  "Exodus 6:2-6:13",
  "Exodus 6:14-6:28",
  "Exodus 6:29-7:7",
  "Exodus 7:8-8:6",
  "Exodus 8:7-8:18",
  "Exodus 8:19-9:16",
  "Exodus 9:17-9:35"
 ],
 "Bo": [
  "Exodus 10:1-10:11",
  "Exodus 10:12-10:23",
  "Exodus 10:24-11:3",
  "Exodus 11:4-12:20",
  "Exodus 12:21-12:28",
  "Exodus 12:29-12:51",
  "Exodus 13:1-13:16"
 ],
 "Beshalach": [
  "Exodus 13:17-14:8",
  "Exodus 14:9-14:14",
  "Exodus 14:15-14:25",
  "Exodus 14:26-15:26",
  "Exodus 15:27-16:10",
  "Exodus 16:11-16:36",
  "Exodus 17:1-17:16"
 ],
 "Yitro": [
  "Exodus 18:1-18:12",
  "Exodus 18:13-18:23",
  "Exodus 18:24-18:27",
  "Exodus 19:1-19:6",
  "Exodus 19:7-19:19",
  "Exodus 19:20-20:14",
  "Exodus 20:15-20:23"
 ],
 "Mishpatim": [
  "Exodus 21:1-21:19",
  "Exodus 21:20-22:3",
  "Exodus 22:4-22:26",
  "Exodus 22:27-23:5",
  "Exodus 23:6-23:19",
  "Exodus 23:20-23:25",
  "Exodus 23:26-24:18"
 ],
 "Terumah": [
  "Exodus 25:1-25:16",
  "Exodus 25:17-25:40",
  "Exodus 26:1-26:14",
  "Exodus 26:15-26:30",
  "Exodus 26:31-26:37",
  "Exodus 27:1-27:8",
  "Exodus 27:9-27:19"
 ],
 "Tetzaveh": [
  "Exodus 27:20-28:12",
  "Exodus 28:13-28:30",
  "Exodus 28:31-28:43",
  "Exodus 29:1-29:18",
  "Exodus 29:19-29:37",
  "Exodus 29:38-29:46",
  "Exodus 30:1-30:10"
 ],
 "Ki Tisa": [
  "Exodus 30:11-31:17",
  "Exodus 31:18-33:11",
  "Exodus 33:12-33:16",
  "Exodus 33:17-33:23",
  "Exodus 34:1-34:9",
  "Exodus 34:10-34:26",
  "Exodus 34:27-34:35"
 ],
 "Vayakhel-Pekudei": [
  "Exodus 35:1-35:29",
  "Exodus 35:30-37:16",
  "Exodus 37:17-37:29",
  "Exodus 38:1-39:1",
  "Exodus 39:2-39:21",
  "Exodus 39:22-39:43",
  "Exodus 40:1-40:38"
 ],
 "Vayikra": [
  "Leviticus 1:1-1:13",
  "Leviticus 1:14-2:6",
  "Leviticus 2:7-2:16",
  "Leviticus 3:1-3:17",
  "Leviticus 4:1-4:26",
  "Leviticus 4:27-5:10",
  "Leviticus 5:11-5:26"
 ],
 "Tzav": [
  "Leviticus 6:1-6:11",
  "Leviticus 6:12-7:10",
  "Leviticus 7:11-7:38",
  "Leviticus 8:1-8:13",
  "Leviticus 8:14-8:21",
  "Leviticus 8:22-8:29",
  "Leviticus 8:30-8:36"
 ],
 "Shemini": [
  "Leviticus 9:1-9:16",
  "Leviticus 9:17-9:23",
  "Leviticus 9:24-10:11",
  "Leviticus 10:12-10:15",
  "Leviticus 10:16-10:20",
  "Leviticus 11:1-11:32",
  "Leviticus 11:33-11:47"
 ],
 "Tazria-Metzora": [
  "Leviticus 12:1-13:23",
  "Leviticus 13:24-13:39",
  "Leviticus 13:40-13:54",
  "Leviticus 13:55-14:20",
  "Leviticus 14:21-14:32",
  "Leviticus 14:33-15:15",
  "Leviticus 15:16-15:33"
 ],
 "Acharei Mot-Kedoshim": [
  "Leviticus 16:1-16:24",
  "Leviticus 16:25-17:7",
  "Leviticus 17:8-18:21",
  "Leviticus 18:22-19:14",
  "Leviticus 19:15-19:32",
  "Leviticus 19:33-20:7",
  "Leviticus 20:8-20:27"
 ],
 "Emor": [
  "Leviticus 21:1-21:15",
  "Leviticus 21:16-22:16",
  "Leviticus 22:17-22:33",
  "Leviticus 23:1-23:22",
  "Leviticus 23:23-23:32",
  "Leviticus 23:33-23:44",
  "Leviticus 24:1-24:23"
 ],
 "Behar-Bechukotai": [
  "Leviticus 25:1-25:18",
  "Leviticus 25:19-25:28",
  "Leviticus 25:29-25:38",
  "Leviticus 25:39-26:9",
  "Leviticus 26:10-26:46",
  "Leviticus 27:1-27:15",
  "Leviticus 27:16-27:34"
 ],
 "Bamidbar": [
  "Numbers 1:1-1:19",
  "Numbers 1:20-1:54",
  "Numbers 2:1-2:34",
  "Numbers 3:1-3:13",
  "Numbers 3:14-3:39",
  "Numbers 3:40-3:51",
  "Numbers 4:1-4:20"
 ],
 "Nasso": [
  "Numbers 4:21-4:37",
  "Numbers 4:38-4:49",
  "Numbers 5:1-5:10",
  "Numbers 5:11-6:27",
  "Numbers 7:1-7:41",
  "Numbers 7:42-7:71",
  "Numbers 7:72-7:89"
 ],
 "Beha'alotcha": [
  "Numbers 8:1-8:14",
  "Numbers 8:15-8:26",
  "Numbers 9:1-9:14",
  "Numbers 9:15-10:10",
  "Numbers 10:11-10:34",
  "Numbers 10:35-11:29",
  "Numbers 11:30-12:16"
 ],
 "Shelach": [
  "Numbers 13:1-13:20",
  "Numbers 13:21-14:7",
  "Numbers 14:8-14:25",
  "Numbers 14:26-15:7",
  "Numbers 15:8-15:16",
  "Numbers 15:17-15:26",
  "Numbers 15:27-15:41"
 ],
 "Korach": [
  "Numbers 16:1-16:13",
  "Numbers 16:14-16:19",
  "Numbers 16:20-17:8",
  "Numbers 17:9-17:15",
  "Numbers 17:16-17:24",
  "Numbers 17:25-18:20",
  "Numbers 18:21-18:32"
 ],
 "Chukat-Balak": [
  "Numbers 19:1-20:6",
  "Numbers 20:7-20:21",
  "Numbers 20:22-21:20",
  "Numbers 21:21-22:12",
  "Numbers 22:13-22:38",
  "Numbers 22:39-23:26",
  "Numbers 23:27-25:9"
 ],
 "Pinchas": [
  "Numbers 25:10-26:4",
  "Numbers 26:5-26:51",
  "Numbers 26:52-27:5",
  "Numbers 27:6-27:23",
  "Numbers 28:1-28:15",
  "Numbers 28:16-29:11",
  "Numbers 29:12-30:1"
 ],
 "Matot-Masei": [
  "Numbers 30:2-31:12",
  "Numbers 31:13-31:54",
  "Numbers 32:1-32:19",
  "Numbers 32:20-33:49",
  "Numbers 33:50-34:15",
  "Numbers 34:16-35:8",
  "Numbers 35:9-36:13"
 ],
 "Devarim": [
  "Deuteronomy 1:1-1:10",
  "Deuteronomy 1:11-1:21",
  "Deuteronomy 1:22-1:38",
  "Deuteronomy 1:39-2:1",
  "Deuteronomy 2:2-2:30",
  "Deuteronomy 2:31-3:14",
  "Deuteronomy 3:15-3:22"
 ],
 "Vaetchanan": [
  "Deuteronomy 3:23-4:4",
  "Deuteronomy 4:5-4:40",
  "Deuteronomy 4:41-4:49",
  "Deuteronomy 5:1-5:18",
  "Deuteronomy 5:19-6:3",
  "Deuteronomy 6:4-6:25",
  "Deuteronomy 7:1-7:11"
 ],
 "Eikev": [
  "Deuteronomy 7:12-8:10",
  "Deuteronomy 8:11-9:3",
  "Deuteronomy 9:4-9:29",
  "Deuteronomy 10:1-10:11",
  "Deuteronomy 10:12-11:9",
  "Deuteronomy 11:10-11:21",
  "Deuteronomy 11:22-11:25"
 ],
 "Re'eh": [
  "Deuteronomy 11:26-12:10",
  "Deuteronomy 12:11-12:28",
  "Deuteronomy 12:29-13:19",
  "Deuteronomy 14:1-14:21",
  "Deuteronomy 14:22-14:29",
  "Deuteronomy 15:1-15:18",
  "Deuteronomy 15:19-16:17"
 ],
 "Shoftim": [
  "Deuteronomy 16:18-17:13",
  "Deuteronomy 17:14-17:20",
  "Deuteronomy 18:1-18:5",
  "Deuteronomy 18:6-18:13",
  "Deuteronomy 18:14-19:13",
  "Deuteronomy 19:14-20:9",
  "Deuteronomy 20:10-21:9"
 ],
 "Ki Teitzei": [
  "Deuteronomy 21:10-21:21",
  "Deuteronomy 21:22-22:7",
  "Deuteronomy 22:8-23:7",
  "Deuteronomy 23:8-23:24",
  "Deuteronomy 23:25-24:4",
  "Deuteronomy 24:5-24:13",
  "Deuteronomy 24:14-25:19"
 ],
 "Ki Tavo": [
  "Deuteronomy 26:1-26:11",
  "Deuteronomy 26:12-26:15",
  "Deuteronomy 26:16-26:19",
  "Deuteronomy 27:1-27:10",
  "Deuteronomy 27:11-28:6",
  "Deuteronomy 28:7-28:69",
  "Deuteronomy 29:1-29:8"
 ],
 "Nitzavim-Vayeilech": [
  "Deuteronomy 29:9-29:28",
  "Deuteronomy 30:1-30:6",
  "Deuteronomy 30:7-30:14",
  "Deuteronomy 30:15-31:6",
  "Deuteronomy 31:7-31:13",
  "Deuteronomy 31:14-31:19",
  "Deuteronomy 31:20-31:30"
 ],
 "Vayakhel": [
  "Exodus 35:1-35:20",
  "Exodus 35:21-35:29",
  "Exodus 35:30-36:7",
  "Exodus 36:8-36:19",
  "Exodus 36:20-37:16",
  "Exodus 37:17-37:29",
  "Exodus 38:1-38:20"
 ],
 "Pekudei": [
  "Exodus 38:21-39:1",
  "Exodus 39:2-39:21",
  "Exodus 39:22-39:32",
  "Exodus 39:33-39:43",
  "Exodus 40:1-40:16",
  "Exodus 40:17-40:27",
  "Exodus 40:28-40:38"
 ],
 "Tazria": [
  "Leviticus 12:1-13:5",
  "Leviticus 13:6-13:17",
  "Leviticus 13:18-13:23",
  "Leviticus 13:24-13:28",
  "Leviticus 13:29-13:39",
  "Leviticus 13:40-13:54",
  "Leviticus 13:55-13:59"
 ],
 "Metzora": [
  "Leviticus 14:1-14:12",
  "Leviticus 14:13-14:20",
  "Leviticus 14:21-14:32",
  "Leviticus 14:33-14:53",
  "Leviticus 14:54-15:15",
  "Leviticus 15:16-15:28",
  "Leviticus 15:29-15:33"
 ],
 "Acharei Mot": [
  "Leviticus 16:1-16:17",
  "Leviticus 16:18-16:24",
  "Leviticus 16:25-16:34",
  "Leviticus 17:1-17:7",
  "Leviticus 17:8-18:5",
  "Leviticus 18:6-18:21",
  "Leviticus 18:22-18:30"
 ],
 "Kedoshim": [
  "Leviticus 19:1-19:14",
  "Leviticus 19:15-19:22",
  "Leviticus 19:23-19:32",
  "Leviticus 19:33-19:37",
  "Leviticus 20:1-20:7",
  "Leviticus 20:8-20:22",
  "Leviticus 20:23-20:27"
 ],
 "Behar": [
  "Leviticus 25:1-25:13",
  "Leviticus 25:14-25:18",
  "Leviticus 25:19-25:24",
  "Leviticus 25:25-25:28",
  "Leviticus 25:29-25:38",
  "Leviticus 25:39-25:46",
  "Leviticus 25:47-26:2"
 ],
 "Bechukotai": [
  "Leviticus 26:3-26:5",
  "Leviticus 26:6-26:9",
  "Leviticus 26:10-26:46",
  "Leviticus 27:1-27:15",
  "Leviticus 27:16-27:21",
  "Leviticus 27:22-27:28",
  "Leviticus 27:29-27:34"
 ],
 "Chukat": [
  "Numbers 19:1-19:17",
  "Numbers 19:18-20:6",
  "Numbers 20:7-20:13",
  "Numbers 20:14-20:21",
  "Numbers 20:22-21:9",
  "Numbers 21:10-21:20",
  "Numbers 21:21-22:1"
 ],
 "Balak": [
  "Numbers 22:2-22:12",
  "Numbers 22:13-22:20",
  "Numbers 22:21-22:38",
  "Numbers 22:39-23:12",
  "Numbers 23:13-23:26",
  "Numbers 23:27-24:13",
  "Numbers 24:14-25:9"
 ],
 "Nitzavim": [
  "Deuteronomy 29:9-29:11",
  "Deuteronomy 29:12-29:14",
  "Deuteronomy 29:15-29:28",
  "Deuteronomy 30:1-30:6",
  "Deuteronomy 30:7-30:10",
  "Deuteronomy 30:11-30:14",
  "Deuteronomy 30:15-30:20"
 ],
 "Matot": [
  "Numbers 30:2-30:17",
  "Numbers 31:1-31:12",
  "Numbers 31:13-31:24",
  "Numbers 31:25-31:41",
  "Numbers 31:42-31:54",
  "Numbers 32:1-32:19",
  "Numbers 32:20-32:42"
 ],
 "Masei": [
  "Numbers 33:1-33:10",
  "Numbers 33:11-33:49",
  "Numbers 33:50-34:15",
  "Numbers 34:16-34:29",
  "Numbers 35:1-35:8",
  "Numbers 35:9-35:34",
  "Numbers 36:1-36:13"
 ],
 "Vezot Haberakhah": [
  "Deuteronomy 33:1-33:7",
  "Deuteronomy 33:8-33:12",
  "Deuteronomy 33:13-33:17",
  "Deuteronomy 33:18-33:21",
  "Deuteronomy 33:22-33:26",
  "Deuteronomy 33:27-33:29",
  "Deuteronomy 34:1-34:12"
 ]
};

// Specific days that don't follow the weekly pattern (Simchas Torah week)
const CHUMASH_DAY_OVERRIDES = {
 "2025-10-15": "Deuteronomy 33:18-34:12|Genesis 1:1-4:18",
 "2025-10-14": "Deuteronomy 33:13-33:17",
 "2025-10-13": "Deuteronomy 33:8-33:12",
 "2025-10-12": "Deuteronomy 33:1-33:7",
 "2026-10-04": "Deuteronomy 33:1-34:12|Genesis 1:1-2:3",
 "2027-10-24": "Deuteronomy 33:1-34:12|Genesis 1:1-2:3",
 "2028-10-13": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2028-10-12": "Deuteronomy 33:22-33:26",
 "2028-10-11": "Deuteronomy 33:18-33:21",
 "2028-10-10": "Deuteronomy 33:13-33:17",
 "2028-10-09": "Deuteronomy 33:8-33:12",
 "2028-10-08": "Deuteronomy 33:1-33:7",
 "2029-10-02": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2029-10-01": "Deuteronomy 33:8-33:12",
 "2029-09-30": "Deuteronomy 33:1-33:7",
 "2030-10-20": "Deuteronomy 33:1-34:12|Genesis 1:1-2:3",
 "2031-10-10": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2031-10-09": "Deuteronomy 33:22-33:26",
 "2031-10-08": "Deuteronomy 33:18-33:21",
 "2031-10-07": "Deuteronomy 33:13-33:17",
 "2031-10-06": "Deuteronomy 33:8-33:12",
 "2031-10-05": "Deuteronomy 33:1-33:7",
 "2032-09-28": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2032-09-27": "Deuteronomy 33:8-33:12",
 "2032-09-26": "Deuteronomy 33:1-33:7",
 "2033-10-16": "Deuteronomy 33:1-34:12|Genesis 1:1-2:3",
 "2034-10-06": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2034-10-05": "Deuteronomy 33:22-33:26",
 "2034-10-04": "Deuteronomy 33:18-33:21",
 "2034-10-03": "Deuteronomy 33:13-33:17",
 "2034-10-02": "Deuteronomy 33:8-33:12",
 "2034-10-01": "Deuteronomy 33:1-33:7",
 "2035-10-26": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2035-10-25": "Deuteronomy 33:22-33:26",
 "2035-10-24": "Deuteronomy 33:18-33:21",
 "2035-10-23": "Deuteronomy 33:13-33:17",
 "2035-10-22": "Deuteronomy 33:8-33:12",
 "2035-10-21": "Deuteronomy 33:1-33:7",
 "2036-10-14": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2036-10-13": "Deuteronomy 33:8-33:12",
 "2036-10-12": "Deuteronomy 33:1-33:7",
 "2037-10-02": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2037-10-01": "Deuteronomy 33:22-33:26",
 "2037-09-30": "Deuteronomy 33:18-33:21",
 "2037-09-29": "Deuteronomy 33:13-33:17",
 "2037-09-28": "Deuteronomy 33:8-33:12",
 "2037-09-27": "Deuteronomy 33:1-33:7",
 "2038-10-22": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2038-10-21": "Deuteronomy 33:22-33:26",
 "2038-10-20": "Deuteronomy 33:18-33:21",
 "2038-10-19": "Deuteronomy 33:13-33:17",
 "2038-10-18": "Deuteronomy 33:8-33:12",
 "2038-10-17": "Deuteronomy 33:1-33:7",
 "2039-10-11": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2039-10-10": "Deuteronomy 33:8-33:12",
 "2039-10-09": "Deuteronomy 33:1-33:7",
 "2040-09-30": "Deuteronomy 33:1-34:12|Genesis 1:1-2:3",
 "2041-10-18": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2041-10-17": "Deuteronomy 33:22-33:26",
 "2041-10-16": "Deuteronomy 33:18-33:21",
 "2041-10-15": "Deuteronomy 33:13-33:17",
 "2041-10-14": "Deuteronomy 33:8-33:12",
 "2041-10-13": "Deuteronomy 33:1-33:7",
 "2042-10-07": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2042-10-06": "Deuteronomy 33:8-33:12",
 "2042-10-05": "Deuteronomy 33:1-33:7",
 "2043-10-27": "Deuteronomy 33:13-34:12|Genesis 1:1-3:21",
 "2043-10-26": "Deuteronomy 33:8-33:12",
 "2043-10-25": "Deuteronomy 33:1-33:7",
 "2044-10-14": "Deuteronomy 33:27-34:12|Genesis 1:1-5:24",
 "2044-10-13": "Deuteronomy 33:22-33:26",
 "2044-10-12": "Deuteronomy 33:18-33:21",
 "2044-10-11": "Deuteronomy 33:13-33:17",
 "2044-10-10": "Deuteronomy 33:8-33:12",
 "2044-10-09": "Deuteronomy 33:1-33:7",
 "2045-10-04": "Deuteronomy 33:18-34:12|Genesis 1:1-4:18",
 "2045-10-03": "Deuteronomy 33:13-33:17",
 "2045-10-02": "Deuteronomy 33:8-33:12",
 "2045-10-01": "Deuteronomy 33:1-33:7"
};
