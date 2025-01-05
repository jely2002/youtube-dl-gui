import asyncio
import base64
import socket, threading
import queue
import time

from mitmproxy import ctx
from mitmproxy import http

LISTENING_PORT = 12000

# Queue to hold requests data to be sent
data_queue = queue.Queue(maxsize=15)

def sendTrafficLoop(trafficLoggerAddon):
  data=''
  deadguard = 0
  checkinterval = 6
  next_checktime = time.time() + checkinterval
  try:
    while data=='':
        try:
          data=trafficLoggerAddon.socket_connection.recv(1)
          print(data)
          trafficLoggerAddon.socket_connection.close()
          trafficLoggerAddon.socket_instance.close()
          ctx.master.shutdown()
        except:
          pass
        if data_queue.qsize()>0:
          msg = data_queue.get()        
          if msg is not None:
            trafficLoggerAddon.socket_connection.send(msg.encode())
        else:
          deadguard=deadguard+1
          current_time = time.time()
          if current_time >= next_checktime:
            #Dirty connection test to crash and exit if OpenVideoDownloader prematurally died
            trafficLoggerAddon.socket_connection.send('testconnection'.encode())
            deadguard = 0
            next_checktime += checkinterval
  except:
    trafficLoggerAddon.socket_connection.close()
    trafficLoggerAddon.socket_instance.close()
    ctx.master.shutdown()
  trafficLoggerAddon.socket_connection.close()
  trafficLoggerAddon.socket_instance.close()
  ctx.master.shutdown()

class TrafficLogger:
  def __init__(self):
    self.socket_instance = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #self.socket_instance.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    self.socket_instance.bind(('127.0.0.1', LISTENING_PORT))
    self.socket_instance.listen(1) #limit to one client
    print('Proxy traffic server running on port 12000: Waiting for OpenVideoDownloader')
    # Accept client connection    
    self.socket_connection, self.address = self.socket_instance.accept()
    self.socket_connection.setblocking(False)
    print('OpenVideoDownloader connected: Ready to send traffic')

    # Launch a thread to send traffic
    thread = threading.Thread(target=sendTrafficLoop, args=([self]))
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
        if k!='If-Range': #TODO: Headers should be filtered in OpenVideoDownloader instead of here
           headers=headers+'{"k":"'+k+'"'+',"v":'+'"'+v.replace('"','\\"')+'"'+'},'
    if headers=="[":
       headers=headers+"]"
    else:
       headers=headers[:-1]+"]"
    rheaders="[]"
    if isrep:    
      rheaders="["
      for k, v in flow.response.headers.items():
        rheaders=rheaders+'{"k":"'+k+'"'+',"v":'+'"'+v.replace('"','\\"')+'"'+'},'
      if rheaders=="[":
         rheaders=rheaders+"]"
      else:
         rheaders=rheaders[:-1]+"]"
    data=""
    if isrep:
      #Don't send large response    
      if len(flow.response.text)<20000000:
       try:
         data=base64.b64encode(flow.response.content[:10000]).decode("ascii")
       except:
         data=""
    msg='{"url":'+url+',"headers":'+headers+',"rheaders":'+rheaders+',"response":"'+data+'"}'
    data_queue.put(msg)

addons = [TrafficLogger()]
