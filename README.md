### Setup

bin/prepare_env.sh

### Logging

/var/log/irctl (pruned every 7 days)

### Restarts 

- crontab chmods /dev/ttyACM0
- "systemctl enable ircrl" so this restarts (entrypoint is bin/irctl.sh)
- software watchdog installed
