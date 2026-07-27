# set base image (host OS)
FROM python:3.8-buster

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Debian buster is EOL; deb.debian.org no longer serves it live. Use the
# frozen snapshot mirror the base image itself references (commented out)
# for this exact date, and disable the Valid-Until check since a frozen
# snapshot's Release file has a fixed expiry in the past.
RUN printf '%s\n' \
      'deb http://snapshot.debian.org/archive/debian/20230612T000000Z buster main' \
      'deb http://snapshot.debian.org/archive/debian-security/20230612T000000Z buster/updates main' \
      'deb http://snapshot.debian.org/archive/debian/20230612T000000Z buster-updates main' \
      > /etc/apt/sources.list \
 && echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until


RUN apt-get -y update
RUN apt-get install -y curl nano wget nginx git

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list


# Mongo
RUN ln -s /bin/echo /bin/systemctl
RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | apt-key add -
RUN echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.4 main" | tee /etc/apt/sources.list.d/mongodb-org-4.4.list
RUN apt-get -y update
RUN apt-get install -y mongodb-org

# Install Yarn
RUN apt-get install -y yarn


ENV ENV_TYPE staging
ENV MONGO_HOST mongo
ENV MONGO_PORT 27017
##########

ENV PYTHONPATH=$PYTHONPATH:/src/

# copy the dependencies file to the working directory
COPY src/requirements.txt .

# install dependencies
RUN pip install -r requirements.txt
