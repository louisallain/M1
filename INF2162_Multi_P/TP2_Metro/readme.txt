. Pour g�rer le graphe du r�seau de la classe Reseau, j'utilise une libraire qui s'appelle GraphStream. "GraphStream est une librairie Java pour la mod�lisation et l'analyse de graphes.", voir leur site web http://graphstream-project.org/

. Proc�dure pour g�n�rer � nouveau le jar ex�cutable de mon TP2 :
	1. En se positionnant dans le r�pertoire racine (o� il y a le readme.txt), compiler les sources : javac -cp ".;./lib/*" ./src/metro/*.java -d .
	2. Cr�er l'ex�cutable : jar cvfm metro.jar MANIFEST.MF metro lib res

. Pour lancer le r�sultat de mon TP2 :
	1. Ouvrir un terminal et taper java -jar Allain_Louis_Metro.jar

. Les sorties sur la console r�sultent des tests qui sont effectu�s dans le programme principal de mon TP.


