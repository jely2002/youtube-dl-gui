import asyncio
import base64
import socket, threading
import queue
import time
import json

from mitmproxy import ctx
from mitmproxy import http

LISTENING_PORT = 12000

# Queue to hold requests data to be sent
data_queue = queue.Queue(maxsize=15)

def sendTrafficLoop(trafficLoggerAddon):
  data=''
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
          current_time = time.time()
          if current_time >= next_checktime:
            #Dirty connection test to crash and exit if OpenVideoDownloader prematurally died
            trafficLoggerAddon.socket_connection.send('testconnection'.encode())
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
    h=[]
    for k, v in flow.request.headers.items():
        h.append({"k":k,"v":v})

    rh=[]
    resp='';
    if isrep:
      for k, v in flow.response.headers.items():
        rh.append({"k":k,"v":v})

      #Don't send large response    
      if len(flow.response.content)<20000000:
       try:
         resp=base64.b64encode(flow.response.content[:40000]).decode("ascii")
       except:
         resp=""
    try:
         requestbody=base64.b64encode(flow.request.content).decode("ascii")
    except:
         requestbody=""

    msg= json.dumps(
    {
     "url": flow.request.pretty_url,
     "method": flow.request.method,
     "requestbody": requestbody,
     "headers": h,
     "rheaders": rh,
     "response": resp
     }
     , indent = 0)
    data_queue.put(str(msg))

addons = [TrafficLogger()]
