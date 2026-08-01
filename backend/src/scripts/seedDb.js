/**
 * scripts/seedDb.js
 * Seed example users, announcements, team posts, and project reviews.
 */

import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import {
  User,
  Profile,
  HackathonResult,
  Announcement,
  TeamPost,
  ProjectReview,
} from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import mongoose from 'mongoose';

dotenv.config();

async function seedData() {
  await connectDB();

  console.log('Seeding example users...');

  const exampleData = [
    { name: 'Ananya Rao', email: 'ananya@reva.edu.in', branch: 'CSE', year: 3, cf_handle: 'tourist', cf_rating: 3800 },
    { name: 'Rahul Singh', email: 'rahul@reva.edu.in', branch: 'ISE', year: 2, cf_handle: 'Benq', cf_rating: 3600 },
    { name: 'Priya Sharma', email: 'priya@reva.edu.in', branch: 'ECE', year: 4, cf_handle: 'Petr', cf_rating: 3400 },
    { name: 'Vikram Malhotra', email: 'vikram@reva.edu.in', branch: 'CSE', year: 1, cf_handle: 'Egor', cf_rating: 3200 },
    { name: 'Sneha Patil', email: 'sneha@reva.edu.in', branch: 'EEE', year: 3, cf_handle: 'maroonrk', cf_rating: 3100 },
  ];

  for (const data of exampleData) {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      console.log(`User ${data.email} already exists, skipping.`);
      continue;
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: hashPassword('password123'),
      branch: data.branch,
      year: data.year,
      admission_year: 2026 - data.year + 1,
      college: 'REVA University',
      is_verified: true,
      college_verified: true,
    });

    const globalScore = data.cf_rating / 10.0 + 150.0;

    const profile = await Profile.create({
      user: user._id,
      cf_handle: data.cf_handle,
      cf_rating: data.cf_rating,
      cf_max_rating: data.cf_rating + 100,
      cf_rank: data.cf_rating > 3000 ? 'legendary grandmaster' : 'grandmaster',
      cf_problems_solved: 1500,
      bio: `Competitive programmer from ${data.branch} branch.`,
      skills: 'Python,C++,Algorithms',
      global_score: globalScore,
    });

    if (data.year > 2) {
      await HackathonResult.create({
        user: user._id,
        hackathon_name: 'Smart India Hackathon',
        position: 1,
        points: 500,
      });
      profile.hackathon_score = 500;
      profile.global_score += 750;
      await profile.save();
    }
  }

  // Seed Announcements
  console.log('Seeding announcements...');
  const adminUser = await User.findOne();
  if (adminUser && !(await Announcement.findOne())) {
    await Announcement.create({
      author: adminUser._id,
      title: "Google HashCode 2025",
      description: "The world's biggest team coding competition is back. Form teams of 2-4 and compete globally!",
      link: 'https://codingcompetitions.withgoogle.com/hashcode',
      category: 'contest',
      event_date: '2025-03-24',
    });
    await Announcement.create({
      author: adminUser._id,
      title: 'College Hackathon 1.0',
      description: 'Participate in our college\'s internal hackathon to win exciting prizes and internship opportunities.',
      category: 'hackathon',
      event_date: '2025-05-15',
      is_pinned: true,
    });
  }

  // Seed Team Posts
  console.log('Seeding team posts...');
  if (adminUser && !(await TeamPost.findOne())) {
    await TeamPost.create({
      author: adminUser._id,
      post_type: 'recruiting',
      title: 'Building an AI startup',
      description: 'We need a frontend developer (React) and a designer for our AI startup project.',
      skills_needed: 'React,UI/UX,Tailwind',
      contact_info: 'discord: @ananya_dev',
      team_size: 4,
    });

    const secondUser = await User.findOne().skip(1);
    if (secondUser) {
      await TeamPost.create({
        author: secondUser._id,
        post_type: 'looking',
        title: 'Looking for a competitive programming team',
        description: "I'm a Specialist on Codeforces, looking for a team for the upcoming ICPC regionals.",
        skills_needed: 'C++,DSA,Algorithms',
        contact_info: 'rahul@reva.edu.in',
      });
    }
  }

  // Seed Project Reviews
  console.log('Seeding project reviews...');
  if (!(await ProjectReview.findOne())) {
    const projectData = [
      {
        name: 'Shardeum DevKit',
        description: 'Comprehensive developer toolkit for the Shardeum network.',
        impl_s: 9.5, impl_r: 'Advanced engineering with Solidity and ethers.js 6.x.',
        imp_s: 8.5, imp_r: 'High-value developer tool for an emerging ecosystem.',
        work_s: 9.0, work_r: 'Production-ready with feature-rich dashboard.',
        total: 9.0,
      },
      {
        name: 'Claude Counter',
        description: 'Browser extension for token counting and usage tracking on Claude.ai.',
        impl_s: 9.0, impl_r: 'Sophisticated SSE interception and custom tokenization.',
        imp_s: 8.0, imp_r: 'High utility for AI developers and power users.',
        work_s: 9.5, work_r: 'Fully functional and shipped on multiple stores.',
        total: 8.8,
      },
      {
        name: 'UniRank',
        description: 'Unified student tracking and ranking platform.',
        impl_s: 8.5, impl_r: 'Clean full-stack architecture with robust security best practices.',
        imp_s: 7.5, imp_r: 'Practical application for university competitive programming cultures.',
        work_s: 9.0, work_r: 'Exceptional documentation and setup clarity.',
        total: 8.3,
      },
      {
        name: 'Kisan Platform',
        description: 'Super app framework for Indian farmers.',
        impl_s: 7.0, impl_r: 'Solid foundation with broad feature roadmap.',
        imp_s: 9.0, imp_r: 'Significant social impact potential and social awareness.',
        work_s: 8.0, work_r: 'Functional MVP with clear path to production persistence.',
        total: 8.0,
      },
    ];

    for (const p of projectData) {
      await ProjectReview.create({
        name: p.name,
        description: p.description,
        implementation_score: p.impl_s,
        implementation_reason: p.impl_r,
        impact_score: p.imp_s,
        impact_reason: p.imp_r,
        working_score: p.work_s,
        working_reason: p.work_r,
        total_score: p.total,
      });
    }
  }

  console.log('Seeding complete! Check your leaderboard and boards now.');
  await mongoose.disconnect();
}

seedData().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
