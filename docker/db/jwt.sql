\set jwt_exp `echo "$JWT_EXP"`

alter database postgres set "app.settings.jwt_exp" to :'jwt_exp';
