API=http://localhost:4000/api

# OWNER: مجاز
OT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.test","password":"Password123!"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
curl -s $API/users -H "Authorization: Bearer $OT"

# EDITOR: باید 403 بگیرد
ET=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"editor@demo.test","password":"Password123!"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
curl -i $API/users -H "Authorization: Bearer $ET"