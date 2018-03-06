#! /bin/bash


# Install Wget
sudo yum -y install wget

# Install Java JDK (1.8)
sudo yum -y install java-1.8.0-openjdk
echo 'export JAVA_HOME=/usr/lib/jvm/jre-1.8.0-openjdk' | sudo tee -a ~/.bashrc
echo 'export JRE_HOME=/usr/lib/jvm/jre' | sudo tee -a ~/.bashrc
source ~/.bashrc


# Install Scala (2.11)
wget http://downloads.lightbend.com/scala/2.11.8/scala-2.11.8.rpm
sudo yum -y install scala-2.11.8.rpm


# Install Hadoop (2.6)
wget http://apache.rediris.es/hadoop/common/hadoop-2.6.5/hadoop-2.6.5.tar.gz
sudo tar xvf hadoop-2.6.5.tar.gz
sudo mkdir /opt/hadoop
cp -rf hadoop-2.6.5/* /opt/hadoop/
chown -R root /opt/hadoop/
echo 'export HADOOP_HOME=/opt/hadoop' | sudo tee -a ~/.bashrc
echo 'export HADOOP_COMMON_HOME=$HADOOP_HOME' | sudo tee -a ~/.bashrc
echo 'export HADOOP_HDFS_HOME=$HADOOP_HOME' | sudo tee -a ~/.bashrc
echo 'export HADOOP_MAPRED_HOME=$HADOOP_HOME' | sudo tee -a ~/.bashrc
echo 'export HADOOP_YARN_HOME=$HADOOP_HOME' | sudo tee -a ~/.bashrc
echo 'export HADOOP_OPTS="-Djava.library.path=$HADOOP_HOME/lib/native"' | sudo tee -a ~/.bashrc
echo 'export HADOOP_COMMON_LIB_NATIVE_DIR=$HADOOP_HOME/lib/native' | sudo tee -a ~/.bashrc
echo 'export PATH=$PATH:$HADOOP_HOME/sbin:$HADOOP_HOME/bin' | sudo tee -a ~/.bashrc
source ~/.bashrc
echo 'export JAVA_HOME=/usr/lib/jvm/jre-1.8.0-openjdk' | sudo tee -a $HADOOP_HOME/etc/hadoop/hadoop-env.sh
sudo mkdir -p /app/hadoop/tmp
sudo chown root /app/hadoop/tmp

## Configuration of core-site.xml file
# <configuration>
#  <property>
#   <name>hadoop.tmp.dir</name>
#   <value>/app/hadoop/tmp</value>
#   <description>A base for other temporary directories.</description>
#  </property>

#  <property>
#   <name>fs.default.name</name>
#   <value>hdfs://localhost:54310</value>
#   <description>The name of the default file system.  A URI whose
#   scheme and authority determine the FileSystem implementation.  The
#   uri's scheme determines the config property (fs.SCHEME.impl) naming
#   the FileSystem implementation class.  The uri's authority is used to
#   determine the host, port, etc. for a filesystem.</description>
#  </property>
# </configuration>

cp $HADOOP_HOME/etc/hadoop/mapred-site.xml.template $HADOOP_HOME/etc/hadoop/mapred-site.xml

## Configuration of mapred-site.xml file
# <configuration>
#  <property>
#   <name>mapred.job.tracker</name>
#   <value>localhost:54311</value>
#   <description>The host and port that the MapReduce job tracker runs
#   at.  If "local", then jobs are run in-process as a single map
#   and reduce task.
#   </description>
#  </property>
# </configuration>

sudo mkdir -p /opt/hadoop_store/hdfs/namenode
sudo mkdir -p /opt/hadoop_store/hdfs/datanode
sudo chown root /opt/hadoop_store

## Configuration of hdfs-site.xml file
# <configuration>
# <property>
#   <name>dfs.replication</name>
#   <value>1</value>
#   <description>Default block replication.
#   The actual number of replications can be specified when the file is created.
#   The default is used if replication is not specified in create time.
#   </description>
#  </property>
#  <property>
#    <name>dfs.namenode.name.dir</name>
#    <value>file:/opt/hadoop_store/hdfs/namenode</value>
#  </property>
#  <property>
#    <name>dfs.datanode.data.dir</name>
#    <value>file:/opt/hadoop_store/hdfs/datanode</value>
#  </property>
# </configuration>

## Format the New Hadoop Filesystem
hadoop namenode -format


# Install Spark (2.0)
wget http://d3kbcqa49mib13.cloudfront.net/spark-2.0.0-bin-hadoop2.6.tgz
sudo tar xvf spark-2.0.0-bin-hadoop2.6.tgz
sudo mkdir /opt/spark
cp -rf spark-2.0.0-bin-hadoop2.6/* /opt/spark/
chown -R root /opt/spark/
echo 'export SPARK_HOME=/opt/spark' | sudo tee -a ~/.bashrc
echo 'export PATH=$PATH:$SPARK_HOME/bin' | sudo tee -a ~/.bashrc
source ~/.bashrc


# Install MongoDB (3.2.11)
sudo touch /etc/yum.repos.d/mongodb-org.repo
echo '[mongodb-org-3.2]' | sudo tee -a /etc/yum.repos.d/mongodb-org.repo
echo 'name=MongoDB Repository' | sudo tee -a /etc/yum.repos.d/mongodb-org.repo
echo 'baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/3.2/x86_64/' | sudo tee -a /etc/yum.repos.d/mongodb-org.repo
echo 'gpgcheck=0' | sudo tee -a /etc/yum.repos.d/mongodb-org.repo
echo 'enabled=1' | sudo tee -a /etc/yum.repos.d/mongodb-org.repo
sudo yum -y install mongodb-org
sudo semanage port -a -t mongod_port_t -p tcp 27017


# Install NodeJS (6.9.4)
wget https://nodejs.org/dist/v6.9.4/node-v6.9.4.tar.gz
tar xzvf node-v* && cd node-v*
sudo yum -y install gcc gcc-c++ make
./configure
make
sudo make install


# Install sbt
curl https://bintray.com/sbt/rpm/rpm > bintray-sbt-rpm.repo
sudo mv bintray-sbt-rpm.repo /etc/yum.repos.d/
sudo yum -y install sbt

# Install Swagger
sudo npm install -g swagger

# Disable Firewall
systemctl disable firewalld
systemctl stop firewalld

# Install Forever
sudo npm install -g forever
