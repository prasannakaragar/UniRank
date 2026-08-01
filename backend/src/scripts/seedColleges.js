/**
 * scripts/seedColleges.js
 * Seed Indian colleges into the College collection.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { College } from '../models/index.js';
import mongoose from 'mongoose';

dotenv.config();

async function seedColleges() {
  await connectDB();

  const colleges = [
    { name: 'IISER Bhopal', domain: 'iiserb.ac.in' },
    { name: 'IISER Pune', domain: 'iiserpune.ac.in' },
    { name: 'IISER Mohali', domain: 'iisermohali.ac.in' },
    { name: 'IISER Kolkata', domain: 'iiserkol.ac.in' },
    { name: 'IISER Thiruvananthapuram', domain: 'iisertvm.ac.in' },
    { name: 'IISER Tirupati', domain: 'iisertirupati.ac.in' },
    { name: 'IISER Berhampur', domain: 'iiserberhampur.ac.in' },
    { name: 'IIT Bombay', domain: 'iitb.ac.in' },
    { name: 'IIT Delhi', domain: 'iitd.ac.in' },
    { name: 'IIT Kanpur', domain: 'iitk.ac.in' },
    { name: 'IIT Kharagpur', domain: 'iitkgp.ac.in' },
    { name: 'IIT Madras', domain: 'iitm.ac.in' },
    { name: 'IIT Roorkee', domain: 'iitr.ac.in' },
    { name: 'IIT Guwahati', domain: 'iitg.ac.in' },
    { name: 'IIT BHU', domain: 'iitbhu.ac.in' },
    { name: 'IIT Hyderabad', domain: 'iith.ac.in' },
    { name: 'IIT Indore', domain: 'iiti.ac.in' },
    { name: 'IIT Ropar', domain: 'iitror.ac.in' },
    { name: 'IIT Mandi', domain: 'iitmandi.ac.in' },
    { name: 'IIT Jodhpur', domain: 'iitj.ac.in' },
    { name: 'IIT Patna', domain: 'iitp.ac.in' },
    { name: 'IIT Gandhinagar', domain: 'iitgn.ac.in' },
    { name: 'IIT Bhubaneswar', domain: 'iitbbs.ac.in' },
    { name: 'REVA University', domain: 'reva.edu.in' },
    { name: 'BMS College of Engineering', domain: 'bmsce.ac.in' },
    { name: 'RV College of Engineering', domain: 'rvce.edu.in' },
    { name: 'PES University', domain: 'pes.edu' },
  ];

  for (const c of colleges) {
    const existing = await College.findOne({ domain: c.domain });
    if (!existing) {
      await College.create({ name: c.name, domain: c.domain });
      console.log(`Added: ${c.name} (${c.domain})`);
    } else {
      console.log(`Already exists: ${c.name}`);
    }
  }

  await mongoose.disconnect();
}

seedColleges().catch((err) => {
  console.error('Seed colleges error:', err);
  process.exit(1);
});
