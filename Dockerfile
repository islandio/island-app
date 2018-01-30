FROM node:8.9.3

# Install zeromq
RUN wget https://github.com/zeromq/libzmq/releases/download/v4.2.1/zeromq-4.2.1.tar.gz && \
    tar -zxvf zeromq-4.2.1.tar.gz && \
    cd zeromq-4.2.1 && ./configure && make && \
    make install && \
    echo /usr/local/lib > /etc/ld.so.conf.d/local.conf && \
    ldconfig

RUN apt-get update && apt-get --yes install python-dev
RUN curl -O https://bootstrap.pypa.io/get-pip.py
RUN python get-pip.py --user
RUN /root/.local/bin/pip install --upgrade --user awsebcli
RUN echo "export PATH=~/.local/bin:\$PATH" >> ~/.bashrc

CMD ["node"]
