import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import CollegeIndex from '../models/CollegeIndex.js';

export const INITIAL_COLLEGE_INDEX = [
  { name: 'Indian Institute of Technology Bombay (IIT Bombay)', domain: 'iitb.ac.in', location: 'Mumbai, Maharashtra', logo_url: 'https://www.collegebatch.com/1-indian-institute-of-technology-campus-tour-mumbai' },
  { name: 'Indian Institute of Technology Delhi (IIT Delhi)', domain: 'iitd.ac.in', location: 'New Delhi, Delhi', logo_url: 'https://wallpaperaccess.com/iit-delhi' },
  { name: 'Indian Institute of Technology Madras (IIT Madras)', domain: 'iitm.ac.in', location: 'Chennai, Tamil Nadu', logo_url: 'https://wallpaperaccess.com/iit-madras' },
  { name: 'Indian Institute of Technology Kharagpur (IIT KGP)', domain: 'iitkgp.ac.in', location: 'Kharagpur, West Bengal', logo_url: '' },
  { name: 'Indian Institute of Technology Kanpur (IIT Kanpur)', domain: 'iitk.ac.in', location: 'Kanpur, Uttar Pradesh', logo_url: '' },
  { name: 'Indian Institute of Technology Roorkee (IIT Roorkee)', domain: 'iitr.ac.in', location: 'Roorkee, Uttarakhand', logo_url: '' },
  { name: 'Indian Institute of Technology Guwahati (IIT Guwahati)', domain: 'iitg.ac.in', location: 'Guwahati, Assam', logo_url: '' },
  { name: 'Indian Institute of Technology Hyderabad (IIT Hyderabad)', domain: 'iith.ac.in', location: 'Sangareddy, Telangana', logo_url: '' },
  { name: 'National Institute of Technology Tiruchirappalli (NIT Trichy)', domain: 'nitt.edu', location: 'Tiruchirappalli, Tamil Nadu', logo_url: '' },
  { name: 'National Institute of Technology Karnataka (NIT Surathkal)', domain: 'nitk.ac.in', location: 'Mangaluru, Karnataka', logo_url: '' },
  { name: 'National Institute of Technology Warangal (NIT Warangal)', domain: 'nitw.ac.in', location: 'Warangal, Telangana', logo_url: '' },
  { name: 'National Institute of Technology Rourkela (NIT Rourkela)', domain: 'nitrkl.ac.in', location: 'Rourkela, Odisha', logo_url: '' },
  { name: 'BITS Pilani - Birla Institute of Technology and Science', domain: 'bits-pilani.ac.in', location: 'Pilani, Rajasthan', logo_url: '' },
  { name: 'BITS Pilani K K Birla Goa Campus', domain: 'bits-goa.ac.in', location: 'Goa', logo_url: '' },
  { name: 'BITS Pilani Hyderabad Campus', domain: 'bits-hyderabad.ac.in', location: 'Hyderabad, Telangana', logo_url: '' },
  { name: 'RV College of Engineering (RVCE)', domain: 'rvce.edu.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'BMS College of Engineering (BMSCE)', domain: 'bmsce.ac.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'BMS Institute of Technology and Management (BMSIT)', domain: 'bmsit.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'PES University (PESU)', domain: 'pes.edu', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'REVA University', domain: 'reva.edu.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'MS Ramaiah Institute of Technology (MSRIT)', domain: 'msrit.edu', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'Dayananda Sagar College of Engineering (DSCE)', domain: 'dsce.edu.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'Vellore Institute of Technology (VIT Vellore)', domain: 'vit.ac.in', location: 'Vellore, Tamil Nadu', logo_url: '' },
  { name: 'SRM Institute of Science and Technology (SRMIST)', domain: 'srmist.edu.in', location: 'Chennai, Tamil Nadu', logo_url: '' },
  { name: 'Amrita Vishwa Vidyapeetham', domain: 'amrita.edu', location: 'Coimbatore, Tamil Nadu', logo_url: '' },
  { name: 'Delhi Technological University (DTU)', domain: 'dtu.ac.in', location: 'New Delhi, Delhi', logo_url: '' },
  { name: 'Netaji Subhas University of Technology (NSUT)', domain: 'nsut.ac.in', location: 'New Delhi, Delhi', logo_url: '' },
  { name: 'International Institute of Information Technology Hyderabad (IIIT Hyderabad)', domain: 'iiit.ac.in', location: 'Hyderabad, Telangana', logo_url: '' },
  { name: 'International Institute of Information Technology Bangalore (IIIT Bangalore)', domain: 'iiitb.ac.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'College of Engineering Pune (COEP)', domain: 'coep.org.in', location: 'Pune, Maharashtra', logo_url: '' },
  { name: 'Jadavpur University Faculty of Engineering', domain: 'jadavpuruniversity.in', location: 'Kolkata, West Bengal', logo_url: '' },
  { name: 'Thapar Institute of Engineering and Technology', domain: 'thapar.edu', location: 'Patiala, Punjab', logo_url: '' },
  { name: 'Manipal Institute of Technology (MIT Manipal)', domain: 'manipal.edu', location: 'Manipal, Karnataka', logo_url: '' },
  { name: 'PSG College of Technology', domain: 'psgtech.edu', location: 'Coimbatore, Tamil Nadu', logo_url: '' },
  { name: 'Veermata Jijabai Technological Institute (VJTI)', domain: 'vjti.ac.in', location: 'Mumbai, Maharashtra', logo_url: '' },
  { name: 'Sardar Patel Institute of Technology (SPIT)', domain: 'spit.ac.in', location: 'Mumbai, Maharashtra', logo_url: '' },
  { name: 'Chaitanya Bharathi Institute of Technology (CBIT)', domain: 'cbit.ac.in', location: 'Hyderabad, Telangana', logo_url: '' },
  { name: 'CMR Institute of Technology (CMRIT)', domain: 'cmrit.ac.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'Nitte Meenakshi Institute of Technology (NMIT)', domain: 'nmit.ac.in', location: 'Bengaluru, Karnataka', logo_url: '' },
  { name: 'Siddaganga Institute of Technology (SIT Tumkur)', domain: 'sit.ac.in', location: 'Tumakuru, Karnataka', logo_url: '' },
];

export async function ensureCollegeIndexSeeded() {
  try {
    const count = await CollegeIndex.countDocuments();
    if (count === 0) {
      await CollegeIndex.insertMany(INITIAL_COLLEGE_INDEX);
      console.log(`[SEED] Populated CollegeIndex with ${INITIAL_COLLEGE_INDEX.length} reference colleges.`);
    }
  } catch (err) {
    console.error('[SEED] Error populating CollegeIndex:', err.message);
  }
}

async function runStandaloneSeed() {
  await connectDB();
  await ensureCollegeIndexSeeded();
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('seedCollegeIndex.js')) {
  runStandaloneSeed();
}
