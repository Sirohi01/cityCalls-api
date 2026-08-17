import '../src/config/env';
import mongoose from 'mongoose';
import { MasterModel, MasterType } from '../src/modules/config/master.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';

interface Row {
  product: string;
  subCategory: string;
  complaint: string;
  symptom: string;
  defect: string;
  repair: string;
  repairCategory: string;
}

const ROWS: Row[] = [
  { product: 'AC', subCategory: 'Split AC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Gas Leak', repair: 'Gas filling', repairCategory: 'Gas Charge' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Gas Leak', repair: 'Gas filling', repairCategory: 'Gas Charge' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Installation Required', symptom: 'Installation', defect: 'Installation Done', repair: 'Installation Done', repairCategory: 'Installation' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Installation Required', symptom: 'Installation', defect: 'Installation Done', repair: 'Installation Done', repairCategory: 'Installation' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Noise Issues', symptom: 'Noise Issues', defect: 'Fan Blade Loose', repair: 'Fan Blade Adjustment', repairCategory: 'Adjustment' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Noise Issues', symptom: 'Noise Issues', defect: 'Fan Blade Loose', repair: 'Fan Blade Adjustment', repairCategory: 'Adjustment' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'Pipe Adjustment', repair: 'Pipe Adjustment', repairCategory: 'Adjustment' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'Pipe Adjustment', repair: 'Pipe Adjustment', repairCategory: 'Adjustment' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Battery Replaced', repair: 'Battery Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Battery Replaced', repair: 'Battery Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Remote Defective', repair: 'Remote  Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Remote Defective', repair: 'Remote  Replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Un-Install', symptom: 'Un-Install', defect: 'Un-Install required', repair: 'Un-Install Done', repairCategory: 'Re-Installation' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Un-Install', symptom: 'Un-Install', defect: 'Un-Install required', repair: 'Un-Install Done', repairCategory: 'Re-Installation' },
  { product: 'AC', subCategory: 'Window AC', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'AC', subCategory: 'Split AC', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Buzzer not working', symptom: 'Wire disconnected', defect: 'Wire Issues', repair: 'Wire Re-Joint', repairCategory: 'Adjustment' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'No spinning', symptom: 'Spin Not working', defect: 'Spin Motor Defective', repair: 'Spin Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'No wash', symptom: 'Wash not working', defect: 'Wash Motor Defective', repair: 'Wash Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Water leakage', symptom: 'Water Drop Coming', defect: 'Valve Bellow Defectve', repair: 'Valve Bellow Replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Water leakage', symptom: 'Water Drop Coming', defect: 'Valve Bellow Spring  Issues', repair: 'Valve Bellow Spring  Loose', repairCategory: 'Adjustment' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Spin Not Working', symptom: 'Spin Not working', defect: 'Spin Timer Defective', repair: 'Spin Timer Replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Wash Not Working', symptom: 'Wash not working', defect: 'Wash Timer Defective', repair: 'Wash Timer replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Spin speed slow', symptom: 'Spin speed slow', defect: 'Spin Motor Defective', repair: 'Spin Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Wash speed slow', symptom: 'Wash speed slow', defect: 'Wash Motor Defective', repair: 'Wash Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Wash Tub Not Working', symptom: 'Wash not working', defect: 'Wash Timer Defective', repair: 'Wash Timer replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Spin Tub Not Working', symptom: 'Spin speed slow', defect: 'Spin Motor Defective', repair: 'Spin Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Semi Automomatic', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Dryer not working', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Spin Error Issues', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Spin Error Issues', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Wash not working', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Wash Error Issues', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Wash Error Issues', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Dryer not working', symptom: 'Dryer not working', defect: 'Main Motor Defective', repair: 'Main Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Wash not working', symptom: 'Wash not working', defect: 'Main Motor Defective', repair: 'Main Motor replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Drain not woking', symptom: 'Drain not woking', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Drain not woking', symptom: 'Drain not woking', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Drain not woking', symptom: 'Drain not woking', defect: 'Drian Motor Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Sound issues', symptom: 'Sound issues', defect: 'Washing Machine Suspension Rod Defective', repair: 'Washing Machine Suspension Rod Replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Sound issues', symptom: 'Sound issues', defect: 'Washing Machine Suspension Rod Defective', repair: 'Washing Machine Suspension Rod Replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Top Load Washin Machine', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Dryer not working', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Spin Error Issues', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Spin Error Issues', symptom: 'Dryer not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Wash not working', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Wash Error Issues', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Wash Error Issues', symptom: 'Wash not working', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Drain not woking', symptom: 'Drain not woking', defect: 'Drian Motor Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Washing Machine', subCategory: 'Front Load Washing Machine', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Not Heating', symptom: 'Not Heating', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Not Heating', symptom: 'Not Heating', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Not Heating', symptom: 'Not Heating', defect: 'Heating Element Defective', repair: 'Heating Element replaced Done', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Current Issues', symptom: 'Current Issues', defect: 'Element defective', repair: 'Element replaced done', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'Pipe joint issues', repair: 'Pipe Joint repair', repairCategory: 'Adjustment' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Water leakage', symptom: 'Water leakage', defect: 'Pipe joint issues', repair: 'Inlet Pipe Replaced', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'No Water', symptom: 'No Water', defect: 'Scaling in Tank', repair: 'Services Done', repairCategory: 'Services' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Slow Water', symptom: 'Slow Water', defect: 'Scaling in Tank', repair: 'Services Done', repairCategory: 'Services' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Not Working', symptom: 'Not Working', defect: 'Power Socket Defective', repair: 'Power Socket Repair Done', repairCategory: 'Adjustment' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Not Heating', symptom: 'Not Heating', defect: 'Thermostate Defective', repair: 'Thermostate Defective', repairCategory: 'Part Replace' },
  { product: 'Geyser', subCategory: 'Electric Geyser', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Gas Leak', repair: 'Gas refilling Done', repairCategory: 'Gas Charge' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Less Cooling', symptom: 'Less Cooling', defect: 'Gas Leak', repair: 'Gas refilling Done', repairCategory: 'Gas Charge' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Less Cooling', symptom: 'Less Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Door Issues', symptom: 'Door Closing issues', defect: 'Door Adjustment Issues', repair: 'Door Adjusted Done', repairCategory: 'Adjustment' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Freesze issues', symptom: 'Freezer Leakage', defect: 'Freezer Defective', repair: 'Freezer Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'No Cooling', symptom: 'Condenser issues', defect: 'Condenser Defective', repair: 'Condenser Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Bulb Not working', symptom: 'Bulb Defective', defect: 'Bulb Defective', repair: 'Bulb Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Shelf Brocken', symptom: 'Shelf Brocken', defect: 'Required Shelf', repair: 'Shelf replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Bottle Door Broken', symptom: 'Bottel Rack Broken', defect: 'Required Bottle Rack', repair: 'Bottle Rack Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Refrigerator', subCategory: 'Single Door-DC', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'Compressor Working', defect: 'Relay OLP Defective', repair: 'Relay OLP replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Gas Leak', repair: 'Gas refilling Done', repairCategory: 'Gas Charge' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Less Cooling', symptom: 'Less Cooling', defect: 'Gas Leak', repair: 'Gas refilling Done', repairCategory: 'Gas Charge' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Less Cooling', symptom: 'Less Cooling', defect: 'Compressor Defective', repair: 'Compressor Replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Door Issues', symptom: 'Door Closing issues', defect: 'Door Adjustment Issues', repair: 'Door Adjusted Done', repairCategory: 'Adjustment' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'Condenser issues', defect: 'Condenser Defective', repair: 'Condenser Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Bulb Not working', symptom: 'Bulb Defective', defect: 'Bulb Defective', repair: 'Bulb Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Shelf Brocken', symptom: 'Shelf Brocken', defect: 'Required Shelf', repair: 'Shelf replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Bottle Door Broken', symptom: 'Bottel Rack Broken', defect: 'Required Bottle Rack', repair: 'Bottle Rack Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'Compressor Working', defect: 'Relay OLP Defective', repair: 'Relay OLP replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Bimetal Defective', repair: 'Replaced Bimetal Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Heater Defective', repair: 'Heater Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'No Cooling', symptom: 'No Cooling', defect: 'Fuse Defective', repair: 'Fuse Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Refrigerator', subCategory: 'Double Door- Frost Free', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Servicing', symptom: 'Servicing', defect: 'Required Servicing', repair: 'Servicing Done', repairCategory: 'Services' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Installation Required', symptom: 'Installation Required', defect: 'Installation Required', repair: 'Installation Done', repairCategory: 'Installation' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Un-Install', symptom: 'Un-Install', defect: 'Un-Install required', repair: 'Un-Install Done', repairCategory: 'Re-Installation' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Sound issues', symptom: 'Sound issues', defect: 'Blower Adjustment', repair: 'Blower Adjustment', repairCategory: 'Adjustment' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Error issues', symptom: 'Error issues', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Error issues', symptom: 'Error issues', defect: 'PCB Defective', repair: 'PCB replaced Done', repairCategory: 'Part Replace' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Chimney', subCategory: 'Chimney', complaint: 'Bulb Not working', symptom: 'Bulb Not working', defect: 'Bulb Defective', repair: 'Bulb Replaced Done', repairCategory: 'Part Replace' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Vertical Line', symptom: 'Vertical Line', defect: 'Panel Defectvie', repair: 'Panel Repair Done', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Horizonta Line', symptom: 'Horizonta Line', defect: 'Panel Defectvie', repair: 'Panel Repair Done', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Not Working', symptom: 'Not Working', defect: 'Main Board Defective', repair: 'Main Board Repair', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Not Working', symptom: 'Not Working', defect: 'Main Board Defective', repair: 'Main Board Replaced', repairCategory: 'Part Replace' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Remote Defective', repair: 'Remote  Replaced', repairCategory: 'Part Replace' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Remote Not Working', symptom: 'Remote Not Working', defect: 'Remote Defective', repair: 'Remote Repair', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'No Picture', symptom: 'No Picture', defect: 'Panel Defectvie', repair: 'Panel Repair Done', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Dust Issues in Panel', symptom: 'Dust Issues in Panel', defect: 'Dust remove from Panel', repair: 'Dust remove Panel OK', repairCategory: 'Repair' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Error issues', symptom: 'Error issues', defect: 'Software issues', repair: 'Software Update', repairCategory: 'Adjustment' },
  { product: 'LED TV', subCategory: 'LED TV', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'PCB Defective', repair: 'PCB replaced Done', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'Magnetron Defective', repair: 'Magnetron Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'Transformer Defective', repair: 'Transformer Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'Diode Defective', repair: 'Diode Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'No Heating', symptom: 'No Heating', defect: 'Capacitor Defective', repair: 'Capacitor Replaced Done', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCB replaced', repairCategory: 'Part Replace' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'Error issues', symptom: 'PCB Error', defect: 'PCB Defective', repair: 'PCb Repair Done', repairCategory: 'Repair' },
  { product: 'Microwave Oven', subCategory: 'Microwave Oven', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
  { product: 'RO', subCategory: 'RO', complaint: 'Un-Install', symptom: 'Un-Install', defect: 'Un-Install required', repair: 'Un-Install Done', repairCategory: 'Re-Installation' },
  { product: 'RO', subCategory: 'RO', complaint: 'Installation Required', symptom: 'Installation', defect: 'Installation Done', repair: 'Installation Done', repairCategory: 'Installation' },
  { product: 'RO', subCategory: 'RO', complaint: 'No Water Supply', symptom: 'No Water Supply', defect: 'Servicing required', repair: 'Servicing Done', repairCategory: 'Services' },
  { product: 'RO', subCategory: 'RO', complaint: 'Servicing required', symptom: 'Servicing required', defect: 'Servicing required', repair: 'Servicing Done', repairCategory: 'Services' },
  { product: 'RO', subCategory: 'RO', complaint: 'RO Not working', symptom: 'RO Not working', defect: 'Adaptor Defective', repair: 'Adaptor Replaced Done', repairCategory: 'Part Replace' },
  { product: 'RO', subCategory: 'RO', complaint: 'TDS issues', symptom: 'TDS issues', defect: 'Fillter Defective', repair: 'Filter Replaced OK', repairCategory: 'Part Replace' },
  { product: 'RO', subCategory: 'RO', complaint: 'Pump Issues', symptom: 'Pump Issues', defect: 'Pump Defective', repair: 'Pump Replaced OK', repairCategory: 'Part Replace' },
  { product: 'RO', subCategory: 'RO', complaint: 'Water Leakage', symptom: 'Water Leakage', defect: 'Pipe Adjustment', repair: 'Pipe Adjustment OK', repairCategory: 'Adjustment' },
  { product: 'RO', subCategory: 'RO', complaint: 'Others', symptom: 'Others', defect: 'Others', repair: 'Others', repairCategory: 'Others' },
];

// Excel Product -> real HOME_APPLIANCES Service.name from rebuildCatalogV2.ts.
const PRODUCT_TO_SERVICE_NAME: Record<string, string> = {
  'AC': 'AC Repair Services & Repair',
  'Refrigerator': 'Refrigerator Repair',
  'Washing Machine': 'Washing Machine Repair & Services',
  'LED TV': 'LED TV Repair & Installation',
  'Microwave Oven': 'Microwave Oven Repair',
  'Geyser': 'Geyser Repair & Services',
  'Chimney': 'Chimney Repair & Services',
  'RO': 'RO Repair & Services',
};

// Excel (Product, SubCategory) -> PRODUCT_TYPE master key + label + optional parent key.
// Reuses the existing placeholder key when it's a real match; adds a new, more
// specific key (parented to the generic one) when the sheet is more granular.
const PRODUCT_TYPE_MAP: Record<string, { key: string; label: string; parentKey?: string }> = {
  'AC|Split AC': { key: 'SPLIT_AC', label: 'Split AC' },
  'AC|Window AC': { key: 'WINDOW_AC', label: 'Window AC' },
  'Refrigerator|Single Door-DC': { key: 'SINGLE_DOOR_FRIDGE', label: 'Single Door - Direct Cool Refrigerator', parentKey: 'REFRIGERATOR' },
  'Refrigerator|Double Door- Frost Free': { key: 'DOUBLE_DOOR_FROST_FREE_FRIDGE', label: 'Double Door - Frost Free Refrigerator', parentKey: 'REFRIGERATOR' },
  'Washing Machine|Semi Automomatic': { key: 'SEMI_AUTOMATIC_WASHING_MACHINE', label: 'Semi-Automatic Washing Machine', parentKey: 'WASHING_MACHINE' },
  'Washing Machine|Top Load Washin Machine': { key: 'TOP_LOAD_WASHING_MACHINE', label: 'Top Load Washing Machine', parentKey: 'WASHING_MACHINE' },
  'Washing Machine|Front Load Washing Machine': { key: 'FRONT_LOAD_WASHING_MACHINE', label: 'Front Load Washing Machine', parentKey: 'WASHING_MACHINE' },
  'Geyser|Electric Geyser': { key: 'ELECTRIC_GEYSER', label: 'Electric Geyser', parentKey: 'GEYSER' },
  'Chimney|Chimney': { key: 'CHIMNEY', label: 'Chimney' },
  'LED TV|LED TV': { key: 'TELEVISION', label: 'Television' },
  'Microwave Oven|Microwave Oven': { key: 'MICROWAVE_OVEN', label: 'Microwave Oven' },
  'RO|RO': { key: 'WATER_PURIFIER', label: 'Water Purifier' },
};

function slugKey(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

class MasterCache {
  private byType = new Map<MasterType, Map<string, mongoose.Types.ObjectId>>(); // normalized label -> id
  private keysInUse = new Map<MasterType, Set<string>>();
  stats = { reused: 0, created: 0 };

  async preload(masterType: MasterType) {
    const existing = await MasterModel.find({ masterType });
    const labelMap = new Map<string, mongoose.Types.ObjectId>();
    const keys = new Set<string>();
    for (const doc of existing) {
      labelMap.set(doc.label.trim().toLowerCase(), doc._id);
      keys.add(doc.key);
    }
    this.byType.set(masterType, labelMap);
    this.keysInUse.set(masterType, keys);
  }

  async upsert(masterType: MasterType, label: string, meta?: Record<string, unknown>): Promise<mongoose.Types.ObjectId> {
    const norm = label.trim().toLowerCase();
    const labelMap = this.byType.get(masterType)!;
    const existingId = labelMap.get(norm);
    if (existingId) {
      this.stats.reused++;
      if (meta) {
        await MasterModel.updateOne({ _id: existingId, 'meta.repairCategory': { $exists: false } }, { $set: meta });
      }
      return existingId;
    }
    const keys = this.keysInUse.get(masterType)!;
    let key = slugKey(label);
    let suffix = 2;
    while (keys.has(key)) {
      key = `${slugKey(label)}_${suffix++}`;
    }
    keys.add(key);
    const doc = await MasterModel.create({ masterType, key, label: label.trim(), meta: meta ?? {}, active: true });
    labelMap.set(norm, doc._id);
    this.stats.created++;
    return doc._id;
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);

  const cache = new MasterCache();
  await Promise.all([
    cache.preload('COMPLAINT_TYPE'),
    cache.preload('SYMPTOM'),
    cache.preload('DEFECT'),
    cache.preload('SOLUTION'),
    cache.preload('PRODUCT_TYPE'),
  ]);

  console.log('[import] resolving product-type masters (adding real sub-types where the sheet is more specific than the placeholder set)...');
  const productTypeMasters = await MasterModel.find({ masterType: 'PRODUCT_TYPE' });
  const productTypeIdByKey = new Map(productTypeMasters.map((m) => [m.key, m._id]));
  const productTypeIdByPair = new Map<string, mongoose.Types.ObjectId>();

  for (const [pairKey, def] of Object.entries(PRODUCT_TYPE_MAP)) {
    let id = productTypeIdByKey.get(def.key);
    if (!id) {
      const parentId = def.parentKey ? productTypeIdByKey.get(def.parentKey) : undefined;
      const doc = await MasterModel.create({
        masterType: 'PRODUCT_TYPE',
        key: def.key,
        label: def.label,
        parentId,
        active: true,
      });
      id = doc._id;
      productTypeIdByKey.set(def.key, id);
    }
    productTypeIdByPair.set(pairKey, id);
  }

  console.log(`[import] processing ${ROWS.length} rows from Defects & Symptoms.xlsx...`);
  const serviceLinks = new Map<string, { complaintTypeIds: Set<string>; symptomIds: Set<string>; defectIds: Set<string>; solutionTypeIds: Set<string>; applicableProductTypeIds: Set<string> }>();

  function linksFor(serviceName: string) {
    let entry = serviceLinks.get(serviceName);
    if (!entry) {
      entry = { complaintTypeIds: new Set(), symptomIds: new Set(), defectIds: new Set(), solutionTypeIds: new Set(), applicableProductTypeIds: new Set() };
      serviceLinks.set(serviceName, entry);
    }
    return entry;
  }

  for (const row of ROWS) {
    const serviceName = PRODUCT_TO_SERVICE_NAME[row.product];
    if (!serviceName) {
      console.warn(`[import] no Service mapping for product "${row.product}" — skipping row`);
      continue;
    }
    const complaintId = await cache.upsert('COMPLAINT_TYPE', row.complaint);
    const symptomId = await cache.upsert('SYMPTOM', row.symptom);
    const defectId = await cache.upsert('DEFECT', row.defect);
    const solutionId = await cache.upsert('SOLUTION', row.repair, { repairCategory: row.repairCategory });
    const productTypeId = productTypeIdByPair.get(`${row.product}|${row.subCategory}`);

    const links = linksFor(serviceName);
    links.complaintTypeIds.add(complaintId.toString());
    links.symptomIds.add(symptomId.toString());
    links.defectIds.add(defectId.toString());
    links.solutionTypeIds.add(solutionId.toString());
    if (productTypeId) links.applicableProductTypeIds.add(productTypeId.toString());
  }

  console.log(`[import] linking ${serviceLinks.size} Home Appliances services...`);
  let servicesLinked = 0;
  let servicesMissing = 0;
  for (const [serviceName, links] of serviceLinks) {
    const res = await ServiceModel.updateOne(
      { name: serviceName },
      {
        $addToSet: {
          complaintTypeIds: { $each: [...links.complaintTypeIds] },
          symptomIds: { $each: [...links.symptomIds] },
          defectIds: { $each: [...links.defectIds] },
          solutionTypeIds: { $each: [...links.solutionTypeIds] },
          applicableProductTypeIds: { $each: [...links.applicableProductTypeIds] },
        },
      }
    );
    if (res.matchedCount > 0) servicesLinked++;
    else {
      servicesMissing++;
      console.warn(`[import] Service "${serviceName}" not found — run rebuildCatalogV2.ts first`);
    }
  }

  console.log(`[import] done — Masters: ${cache.stats.created} created, ${cache.stats.reused} reused. Services linked: ${servicesLinked}, missing: ${servicesMissing}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
