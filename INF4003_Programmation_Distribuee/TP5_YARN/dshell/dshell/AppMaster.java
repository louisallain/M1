package dshell;

import java.io.IOException;
import java.util.Collections;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.yarn.api.ApplicationConstants;
import org.apache.hadoop.yarn.api.protocolrecords.AllocateResponse;
import org.apache.hadoop.yarn.api.records.Container;
import org.apache.hadoop.yarn.api.records.ContainerLaunchContext;
import org.apache.hadoop.yarn.api.records.ContainerStatus;
import org.apache.hadoop.yarn.api.records.FinalApplicationStatus;
import org.apache.hadoop.yarn.api.records.Priority;
import org.apache.hadoop.yarn.api.records.Resource;
import org.apache.hadoop.yarn.client.api.AMRMClient;
import org.apache.hadoop.yarn.client.api.NMClient;
import org.apache.hadoop.yarn.conf.YarnConfiguration;
import org.apache.hadoop.yarn.exceptions.YarnException;
import org.apache.hadoop.yarn.util.Records;

public class AppMaster {


    public static void main(String[] args) throws YarnException, IOException, InterruptedException {

        Configuration configuration = new YarnConfiguration();
        String command = args[0];
        int numberOfContainers = Integer.parseInt(args[1]);
        System.out.println("Starting Application Master");
        AMRMClient<AMRMClient.ContainerRequest> resourceManagerClient = AMRMClient.createAMRMClient();
        resourceManagerClient.init(configuration);
        resourceManagerClient.start();
        System.out.println("Started AMRMClient");
        NMClient nodeManagerClient = NMClient.createNMClient();
        nodeManagerClient.init(configuration);
        nodeManagerClient.start();
        System.out.println("Started NMClient");
        resourceManagerClient.registerApplicationMaster("localhost", 80010, "myappmaster");
        System.out.println("Registration done");
        // Priority for worker containers - priorities are intra-application
        Priority priority = Records.newRecord(Priority.class);
        priority.setPriority(0);
        // Resource requirements for worker containers
        Resource capability = Records.newRecord(Resource.class);
        capability.setVirtualCores(1);
        for(int i=0; i < numberOfContainers; i++){
            AMRMClient.ContainerRequest containerRequest = new AMRMClient.ContainerRequest(capability, null, null, priority);
            resourceManagerClient.addContainerRequest(containerRequest);
        }
        int completedContainers = 0;
        int containerId = 0;
        while(completedContainers < numberOfContainers){
            AllocateResponse allocateResponse = resourceManagerClient.allocate(containerId);
            containerId++;
            for(Container container : allocateResponse.getAllocatedContainers()){
                ContainerLaunchContext shellContainerContext = Records.newRecord(ContainerLaunchContext.class);
                shellContainerContext.setCommands(
                        Collections.singletonList(command +
                                 " 1>"  +
                                  ApplicationConstants.LOG_DIR_EXPANSION_VAR + "/stdout "  +
                                 " 2>"  +
                                  ApplicationConstants.LOG_DIR_EXPANSION_VAR + "/stderr"));
                nodeManagerClient.startContainer(container, shellContainerContext);
            }
            for(ContainerStatus containerStatus : allocateResponse.getCompletedContainersStatuses()){
              completedContainers++;
              System.out.println("Completed Container " + completedContainers + " " + containerStatus);
            }
            Thread.sleep(500);    
        } 
        resourceManagerClient.unregisterApplicationMaster(FinalApplicationStatus.SUCCEEDED, "", "");
    }
}
