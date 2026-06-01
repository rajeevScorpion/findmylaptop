INSERT INTO public.courses (category, name, workload_level, recommended_cpu, recommended_gpu, recommended_ram, recommended_storage, recommended_display) VALUES

-- Fashion and Lifestyle
('Fashion and Lifestyle', 'Fashion Design & Technology',    'balanced', 'Intel i7/i9 H/HX or Ryzen 7/9 HS/HX', 'RTX 4050 minimum, RTX 4060 preferred', '16GB minimum, 24/32GB preferred', '1TB preferred', '100% sRGB or better preferred'),
('Fashion and Lifestyle', 'Fashion Communication & Styling','light',    'Intel i5/i7 H-series or Ryzen 5/7 HS', 'RTX 3050 minimum, RTX 4050 preferred',  '16GB minimum, upgradeable preferred',   '512GB minimum, 1TB preferred', 'Good colour accuracy preferred'),
('Fashion and Lifestyle', 'Luxury & Brand Management',      'light',    'Intel i5/i7 H-series or Ryzen 5/7 HS', 'RTX 3050 minimum, RTX 4050 preferred',  '16GB minimum, upgradeable preferred',   '512GB minimum, 1TB preferred', 'Good colour accuracy preferred'),

-- Communication and Digital Media
('Communication and Digital Media', 'Communication Design', 'light',    'Intel i5/i7 H-series or Ryzen 5/7 HS', 'RTX 3050 minimum, RTX 4050 preferred',  '16GB minimum, upgradeable preferred',   '512GB minimum, 1TB preferred', 'Good colour accuracy preferred'),
('Communication and Digital Media', 'Digital Design',       'balanced', 'Intel i7/i9 H/HX or Ryzen 7/9 HS/HX', 'RTX 4050 minimum, RTX 4060 preferred', '16GB minimum, 24/32GB preferred', '1TB preferred', '100% sRGB or better preferred'),

-- Industrial and Interaction Design
('Industrial and Interaction Design', 'Product & Service Design',  'balanced', 'Intel i7/i9 H/HX or Ryzen 7/9 HS/HX', 'RTX 4050 minimum, RTX 4060 preferred', '16GB minimum, 24/32GB preferred', '1TB preferred', '100% sRGB or better preferred'),
('Industrial and Interaction Design', 'Interaction Design',        'balanced', 'Intel i7/i9 H/HX or Ryzen 7/9 HS/HX', 'RTX 4050 minimum, RTX 4060 preferred', '16GB minimum, 24/32GB preferred', '1TB preferred', '100% sRGB or better preferred'),
('Industrial and Interaction Design', 'Transportation & Mobility Design', 'heavy', 'Intel i7/i9 HX or Ryzen 7/9 HX/HS', 'RTX 4060 minimum, RTX 4070 or higher preferred', '24/32GB preferred', '1TB minimum preferred', 'High refresh, good colour, QHD preferred'),

-- Game, Animation, and Film
('Game, Animation, and Film', 'Game Art',            'heavy', 'Intel i7/i9 HX or Ryzen 7/9 HX/HS', 'RTX 4060 minimum, RTX 4070 or higher preferred', '24/32GB preferred', '1TB minimum preferred', 'High refresh, good colour, QHD preferred'),
('Game, Animation, and Film', 'Game Design / Programming', 'heavy', 'Intel i7/i9 HX or Ryzen 7/9 HX/HS', 'RTX 4060 minimum, RTX 4070 or higher preferred', '24/32GB preferred', '1TB minimum preferred', 'High refresh, good colour, QHD preferred'),
('Game, Animation, and Film', 'Animation & Film Making', 'heavy', 'Intel i7/i9 HX or Ryzen 7/9 HX/HS', 'RTX 4060 minimum, RTX 4070 or higher preferred', '24/32GB preferred', '1TB minimum preferred', 'High refresh, good colour, QHD preferred'),

-- Interior and Spatial Design
('Interior and Spatial Design', 'Interior Architecture & Design', 'balanced', 'Intel i7/i9 H/HX or Ryzen 7/9 HS/HX', 'RTX 4050 minimum, RTX 4060 preferred', '16GB minimum, 24/32GB preferred', '1TB preferred', '100% sRGB or better preferred'),

-- AI and Emerging Creative Practice
('AI and Emerging Creative Practice', 'AI in Creative Practice', 'heavy', 'Intel i7/i9 HX or Ryzen 7/9 HX/HS', 'RTX 4060 minimum, RTX 4070 or higher preferred', '24/32GB preferred', '1TB minimum preferred', 'High refresh, good colour, QHD preferred'),

-- Foundation and Global Design
('Foundation / Global Design', 'Global Design Programme', 'light', 'Intel i5/i7 H-series or Ryzen 5/7 HS', 'RTX 3050 minimum, RTX 4050 preferred', '16GB minimum, upgradeable preferred', '512GB minimum, 1TB preferred', 'Good colour accuracy preferred')

ON CONFLICT (name) DO NOTHING;
