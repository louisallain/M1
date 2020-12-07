package allain1.philosophers_V0;

import net.jini.space.JavaSpace;

public class SemaphoreAccessor {

    private JavaSpace space;
    private String resource;

    public SemaphoreAccessor(JavaSpace space, String resource) {
        this.space = space;
        this.resource = resource;
    }

    public void create(int num) {
        for(int i = 0; i < num; i++) {
            SemaphoreEntry entry = new SemaphoreEntry(this.resource);
            try {
                space.write(entry, null, 1000*60);
            }
            catch(Exception e) {
                e.printStackTrace();
            }
        }
    }

    public void down() {
        SemaphoreEntry entry = new SemaphoreEntry(this.resource);
        try {
            space.take(entry, null, Long.MAX_VALUE);
        }
        catch(Exception e) {
            e.printStackTrace();
        }
    }

    public void up() {
        SemaphoreEntry entry = new SemaphoreEntry(this.resource);
        try {
            space.write(entry, null, 1000*60);
        }
        catch(Exception e) {
            e.printStackTrace();
        }
    }
}