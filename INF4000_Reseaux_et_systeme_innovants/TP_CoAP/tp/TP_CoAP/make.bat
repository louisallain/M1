javac -cp ./lib/* -d  ./build ./src/allain/coap/*.java; cd ./build; jar cf ../lib/tp.jar allain; cd ..


Rem java -cp ./lib/* allain.coap.Server