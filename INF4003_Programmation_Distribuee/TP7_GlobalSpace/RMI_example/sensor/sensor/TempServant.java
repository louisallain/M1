/**
 * @author raimbaul
 */
package sensor;

import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Random;

public class TempServant extends UnicastRemoteObject implements Observable, Runnable {

  private double current_temp, previous_temp;
  private List<Observer> listeners;
  private Random rnd;
  
  protected TempServant() throws RemoteException {
    
    rnd= new Random();
    previous_temp= current_temp= 15+rnd.nextDouble()*10;
    listeners= Collections.synchronizedList(new ArrayList<Observer>(10));
    System.out.println("[thermometer] starting"); 
    new Thread(this).start();
  }
  public double get() throws RemoteException {
    
    return current_temp;
  }
  public void register(Observer listener) throws RemoteException {
    
    listeners.add(listener);
    System.out.println("[thermometer] one listener added ("+listeners.size()+" present)");
  }
  public void unregister(Observer listener) throws RemoteException {
    
    listeners.remove(listener);
    System.out.println("[thermometer] one listener removed ("+listeners.size()+" present)");
  }

  private void notifyListeners(){

    if (listeners.isEmpty()) return;
    if (Math.abs(current_temp-previous_temp) < 0.5) return;
    previous_temp= current_temp;
    for (Iterator<Observer> iter=listeners.iterator();iter.hasNext();){
      try {
        iter.next().notify(current_temp);
      } catch (RemoteException e) {
        System.err.println("[thermometer] error"+e.getMessage());
        iter.remove();
        System.out.println("[thermometer] one listener removed ("+listeners.size()+" present)");
      }
    }
  }
  public void run() {
    
    while(true){
      current_temp += rnd.nextDouble()*2-1;
      notifyListeners();
      System.out.println("[thermometer] new temp is "+current_temp);
      try {
        Thread.sleep(rnd.nextInt(4000));
      } catch (InterruptedException ignore) {
      }
    }
  }
}
