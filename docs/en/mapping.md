![Logo](../../admin/autodarts.svg)
### Adapter for Autodarts Integration
[back to start page](README.md)

## Hardware assignments

![Hardware assignments tab](img/tabMappingEn.png)

The **Hardware assignments** tab links optional ioBroker data points to the Autodarts objects, for example for light and power control.

### Light control assignments (optional)

Link your lighting data points to the Autodarts objects.  
If you leave the fields empty, the light control in the adapter remains completely disabled.

Data point used to switch the LED ring on the board via the Autodarts adapter.  
Typically this is a boolean data point (`true` = on, `false` = off).

Link your power data points (e.g. smart sockets, monitor power) to the Autodarts objects.  
If you leave the fields empty, the power control in the adapter remains disabled.

#### Power data point

Data point of your control or monitor socket that switches the power supply around the dartboard.  
Here as well, a boolean switch data point is usually used.
