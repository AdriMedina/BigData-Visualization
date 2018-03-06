# Herramienta de Visualizaciones Gráficas con Spark, Hadoop, Node.JS y MongoDB


Este proyecto es mi Trabajo de Fin de Grado dirigido por José Manuél Benitez Sánchez y Manuel Jesús Parra Royón, profesorado de la Universidad de Granada.

Este proyecto consiste en una biblioteca capaz de generar representaciones gráficas a partir de grandes conjuntos de datos, conocidos como 'Big Data'. Para conseguirlo, se ha desglosado en varios sub-objetivos distintos:

- Crear una biblioteca que, dados unos datos de entrada de tipo 'Big Data', sea capaz de procesar tal cantidad de información, para obtener como resultado variables o datos que necesita cada uno de los gráficos para su representación, como pueden ser valores máximos o mínimos del conjunto de datos, cuartiles, medias, agrupaciones de variables discretas, etc. La complejidad de este objetivo es obtener estos valores a partir de datos que superan fácilmente el millón de registros.
- Dotar a la herramienta de una API RESTful, que permite obtener información de cada una de las funciones que se han implementado, con la posibilidad de ejecutarlas de forma individual.
- Construir una interfaz web que permita el acceso y la utilización de la herramienta de manera sencilla, eficaz y accesible desde cualquier plataforma o dispositivo.

Para conocer en profundidad el funcionamiento, diseño y ejecución de la biblioteca, puede consultar la documentación que se encuentra en el repositorio: 
https://github.com/AdriMedina/BigData-Visualization-Doc

## Computación en Big Data

Las herramientas utilizadas sobre las que se implementa la biblioteca para realizar el computo y almacenamiento sobre los datos, guardado de los resultados obtenidos y conexión con la interfaz web son:
- Hadoop
- Spark
- MongoDB
- NodeJS

## Lenguajes de programación y herramientas

Para la implementación de la funcionalidad de la biblioteca al completo, se han utilizado los siguientes lenguajes y herramientas:
- Scala
- D3JS
- HTML, CSS y JavaScript
- Swagger

## Diseño de la biblioteca

Establecer el ámbito de las tareas que realiza la API, es el primer paso para conseguir un buen diseño de la arquitectura. Conocer a priori en qué momento se ejecutan cada una, es lo que ayuda a clasificarlas de alguna manera. Dicho esto, se pensó que lo mejor era dividir el programa en tres niveles o capas, superior o de interfaz, intermedia o de comunicación, e inferior o de procesamiento.

![Arquitectura](https://648b635f-a-62cb3a1a-s-sites.googlegroups.com/site/amedinag13/home-1/Arquitectura_del_sistema.jpeg?attachauth=ANoY7crKDR-RAbC1vbbXy-_9t22b1mIac0ih2w3Rwap0iYMBEpj2UHqroC074xa8ws_RWnYdJ3okW4-dCiR_tpqnSL1DIBRBc7VBXWPBuY93h89iiVShQngpi_9r1p_hnrt8v5Xavzs1ciZb_YQhf6ZpwoEEkhCPmtz5eM9qvBR8edWU2YULTlnCy1CHwABSW1zAg3Q7Ed_IkLLuFLdX6evd428kq38xzSo8S31ZZiI-9KXyoZyYZbo%3D&attredirects=0)

El nivel superior o nivel de interfaz, es el encargado de comunicarse directamente con el usuario de la aplicación. En él, se aloja la parte web con la que trabajan los usuarios, permitiendo recoger la información que solicitan, para después, enviarla al nivel intermedio. La interfaz de la API está diseñada para poder trabajar con varios usuarios de manera concurrente, o poder trabajar sobre varias pestañas o ventanas una sola persona. Toda la funcionalidad de esta capa está escrita en Javascript, haciendo que la interfaz sea dinámica.

En el nivel intermedio o de comunicación, es donde se realiza toda la comunicación entre las distintas herramientas y hace que el flujo de datos entre la capa superior y la inferior sea el correcto. Aquí es donde se ejecuta NodeJS, siendo el encargado de recoger todos los tipos de eventos y acciones que se producen en la capa superior, para a continuación, realizar la solicitud de procesamiento de la información recibida a la capa inferior donde se encuentra Spark. Se puede decir que es el corazón del sistema, donde se gestiona toda la información y también es el encargado de crear el servidor virtual permitiendo que la aplicación pueda funcionar a través de un navegador web. También se encarga de la comunicación con MongoDB para obtener los resultados devueltos por Spark, para después, dibujar el gráfico solicitado y mandarlo a la capa superior, utilizando para ello la librería D3JS.

Por último, en el nivel inferior o de procesamiento, se aplican los esquemas de agrupación y las técnicas de reducción elegidas para cada uno de los gráficos disponibles en la API. En este nivel es donde se alojan las herramientas Hadoop, Spark y MongoDB. Cada una de ellas tiene su propia función dentro del nivel, siendo así Hadoop el encargado de almacenar y mantener los datos del sistema, Spark el encargado de coger el fichero del HDFS, procesar los datos aplicando los esquemas de agrupación indicados, y por parte de MongoDB, guardar el resultado enviado del procesado de Spark, manteniendo información acerca del estado de cada uno de los resultados, como la fecha de inicio de solicitud, o finalizado el cálculo, además de información acerca de si se está ejecutando en un instante preciso o ha finalizado. Esto sirve de ayuda para conocer si se está procesando ya un gráfico con unos parámetros y fichero de datos concreto, o, si se vuelve a solicitar, no volver a realizar el cálculo, sino esperar a que ese termine para devolver el resultado a la capa de comunicación.

## Métodos de visualización empleados e interfaz

A continuación, se puede apreciar un listado con todos los métodos de visualización disponibles en la API:
- Histograma
- Boxplot
- Scatterplot
- Heatmap
- Bubble Chart
- Scatterplot Matrix
- Pie Chart
- Line Chart
- Stacked Area Chart
- Bar Chart

Como ya se ha explicado anteriormente, todo el sistema está desarrollado para funcionar sobre conjuntos de datos 'Big Data'. Esto conlleva que los cálculos sobre esos conjuntos de datos sea realmente la dificultad que tiene este proyecto. Para obtener una representación gráfica, por ejemplo un histograma o un boxplot, es necesario obtener unos valores calculados como máximo, mínimo, cuartiles, agrupaciones, conteo de datos, etc. Aquí es donde realmente está la complejidad de representar un histograma en comparación con otras herramientas clásicas, sobre conjuntos de datos de menor tamaño.

Spark provee funcionalidad que permite calcular estas operaciones o parte de ellas de manera rápida y eficaz, pero lo interesante de este proyecto es la utilización de estas herramientas, para obtener los valores y a continuación, crear un gráfico representativo de lo que ocurre con el conjunto 'Big Data'.

En las siguientes imágenes se pueden apreciar algunas capturas de la interfaz web desde la que se utilizan las distintas funciones de la biblioteca:

![Interfaz-Inicial](https://648b635f-a-62cb3a1a-s-sites.googlegroups.com/site/amedinag13/home-1/interfaz_inicial.png?attachauth=ANoY7coY8CWtOnr8m10EYul3YhTLs-DcXBnublvV-SLRlcKvqHRwUbbGYWegsdzvJlh60dZm9v1f56CX2X1HXDPLPifGXaD3-T7IXlhONgv3mwrS1HATOKOeuZKgSWTAdBDEeP9z6-ds-vu1szxltxYZTvT7_Hl_Oym86TYA0WmFdb6X714codWu7AZPnLnO4owhI4sokVudDb03nZPoVc1eYsd4B_tbUYlzIWoVW89R--WHhE004uI%3D&attredirects=0)


![Interfaz-Inicial2](https://648b635f-a-62cb3a1a-s-sites.googlegroups.com/site/amedinag13/home-1/lista_ultimos_graficos.PNG?attachauth=ANoY7cpr3Z4lj7Z4BW75_NfzeoucFYrdXbGzbjzdAfh-aWnhA6w9Rxyn3EnHMS5YFPqGYeZ75BTQraPeKHmwW_3Drh4Sg532BfZEZkyFnJyeF-YMtwXP1uGHAxAMuNAO-QXmuR6Yo_aBUdyGkp0uRyZ_ijtpHEL0N2vMBeAnsNX6OC4Fv6CHivu2YWrFs89H35cSZOjcKvWm5AhnTH1Yyeg1tp5_EWdl6cG_nSgvqNmxoN-wFNGw9n4%3D&attredirects=0)



