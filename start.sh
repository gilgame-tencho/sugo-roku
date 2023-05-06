echo start database.js
forever start database.js

echo start main.js
forever start main.js

echo start done

tail /c/Users/rh832/.forever/*.log -f
