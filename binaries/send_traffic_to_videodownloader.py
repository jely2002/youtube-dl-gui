import asyncio
import base64
import socket, threading
import queue
import time

from mitmproxy import ctx
from mitmproxy import http

LISTENING_PORT = 12000

# Queue to hold shared data
data_queue = queue.Queue(maxsize=15)

def serverloop(selfs):
  data=''
  deadguard=0
  try:
    while data=='':
        try:
          #die on any message
          data=selfs.socket_connection.recv(1)
          print(data)
          selfs.socket_instance.close()
          selfs.socket_connection.close()
          ctx.master.shutdown()
        except:
          pass
        if data_queue.qsize()>0:
          #send to OpenVideoDownloader
          msg = data_queue.get()        
          if msg is not None:
            selfs.socket_connection.send(msg.encode())
        else:
          deadguard=deadguard+1
          if deadguard>100000000:
            #selfs.socket_connection.send('testconnection'.encode()) #dirty connection test to exit even if OpenVideoDownloader prematuraturaly die
            deadguard=0
  except:  
    selfs.socket_instance.close()
    selfs.socket_connection.close()
    ctx.master.shutdown()
  selfs.socket_instance.close()
  selfs.socket_connection.close()
  ctx.master.shutdown()

class TrafficLogger:
  def __init__(self):
    
    self.socket_instance = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #self.socket_instance.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    self.socket_instance.bind(('127.0.0.1', LISTENING_PORT))
    self.socket_instance.listen(1) #limit to one client
    print('Server running!')    
    self.socket_connection, self.address = self.socket_instance.accept()
    self.socket_connection.setblocking(False)
    print('new listener!')

    thread = threading.Thread(target=serverloop, args=([self]))
    thread.start()
        
  def request(self, flow):
    self.checkflow(flow, False)

  def response(self, flow):
    self.checkflow(flow, True)
    return

  def checkflow(self,flow,isrep):
    url='"'    + flow.request.url+  '"'
    headers="["
    for k, v in flow.request.headers.items():
        if k!='If-Range':
           headers=headers+'{"k":"'+k+'"'+',"v":'+'"'+v.replace("\"","\\\"")+'"'+'},'
    headers=headers[:-1]+"]"
    rheaders="[]"
    if isrep:    
      rheaders="["
      for k, v in flow.response.headers.items():
        rheaders=rheaders+'{"k":"'+k+'"'+',"v":'+'"'+v.replace("\"","\\\"")+'"'+'},'
      rheaders=rheaders[:-1]+"]"
    data=""
    if isrep:
      #Don't send large response    
      if len(flow.response.text)<50000000:
       try:
         data=base64.b64encode(flow.response.content).decode("ascii")
       except:
         data=""
    msg='{"url":'+url+',"headers":'+headers+',"rheaders":'+rheaders+',"response":"'+data+'"}'
    data_queue.put(msg)

addons = [TrafficLogger()]    
