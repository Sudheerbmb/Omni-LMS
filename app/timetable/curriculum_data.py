"""
CBSE & NCERT Standard Curriculum & Detailed Chapter Syllabus Dataset (Classes 1 to 10).
Provides rich chapter breakdowns, learning outcomes, estimated duration, and topics for all school subjects.
"""
from typing import Dict, List, Any, Optional

CHAPTERS_DB = {
    "MATH_1": [
        {
            "num": 1,
            "title": "Shapes and Space",
            "duration_weeks": 2,
            "topics": [
                "Spatial Relationships",
                "Inside-Outside",
                "Bigger-Smaller",
                "Nearer-Farther"
            ],
            "outcomes": "Identify basic 2D and 3D shapes in real life."
        },
        {
            "num": 2,
            "title": "Numbers from 1 to 9",
            "duration_weeks": 3,
            "topics": [
                "Counting Objects",
                "Number Names",
                "More or Less",
                "Making Groups"
            ],
            "outcomes": "Recognize and write numerals 1 through 9 with counting."
        },
        {
            "num": 3,
            "title": "Addition (Up to 9)",
            "duration_weeks": 3,
            "topics": [
                "Combining Sets",
                "Adding One More",
                "Zero as a Count",
                "Number Bonds"
            ],
            "outcomes": "Perform basic single-digit additions using concrete items."
        },
        {
            "num": 4,
            "title": "Subtraction (Up to 9)",
            "duration_weeks": 3,
            "topics": [
                "Taking Away",
                "How Many Left?",
                "Subtracting Zero",
                "Difference"
            ],
            "outcomes": "Understand taking away and find remaining count."
        },
        {
            "num": 5,
            "title": "Numbers from 10 to 20",
            "duration_weeks": 3,
            "topics": [
                "Bundles of Ten",
                "Place Value Concept",
                "Ordering Numbers",
                "Missing Numbers"
            ],
            "outcomes": "Master place value foundation of Tens and Ones."
        },
        {
            "num": 6,
            "title": "Time and Daily Routine",
            "duration_weeks": 2,
            "topics": [
                "Morning, Afternoon, Night",
                "Order of Daily Activities",
                "Earlier and Later"
            ],
            "outcomes": "Sequence events chronologically throughout the day."
        },
        {
            "num": 7,
            "title": "Measurement Basics",
            "duration_weeks": 2,
            "topics": [
                "Longer-Shorter",
                "Taller-Shorter",
                "Heavier-Lighter",
                "Non-standard Units"
            ],
            "outcomes": "Compare lengths and weights using handspans and paces."
        },
        {
            "num": 8,
            "title": "Numbers from 21 to 50",
            "duration_weeks": 3,
            "topics": [
                "Skip Counting by 2s and 5s",
                "Number Patterns",
                "Expanded Form"
            ],
            "outcomes": "Count and represent numbers up to 50 smoothly."
        },
        {
            "num": 9,
            "title": "Data Handling & Patterns",
            "duration_weeks": 2,
            "topics": [
                "Counting Repetitive Shapes",
                "Finding Patterns",
                "Sorting Lists"
            ],
            "outcomes": "Observe visual rhythms and complete pattern sequences."
        },
        {
            "num": 10,
            "title": "Money & Coins",
            "duration_weeks": 2,
            "topics": [
                "Recognizing Coins (1, 2, 5, 10)",
                "Rupee Notes",
                "Simple Bill Calculation"
            ],
            "outcomes": "Identify currency coins and perform mock shop purchases."
        }
    ],
    "MATH_2": [
        {
            "num": 1,
            "title": "What is Long, What is Round?",
            "duration_weeks": 2,
            "topics": [
                "Rolling vs Sliding Objects",
                "Tallest Tower Building",
                "Spheres and Cylinders"
            ],
            "outcomes": "Categorize items by physical geometry and motion."
        },
        {
            "num": 2,
            "title": "Counting in Groups",
            "duration_weeks": 3,
            "topics": [
                "Pairs and Triads",
                "Estimating Large Collections",
                "Counting in Tens"
            ],
            "outcomes": "Count large numbers rapidly using group aggregation."
        },
        {
            "num": 3,
            "title": "How Much Can You Carry?",
            "duration_weeks": 2,
            "topics": [
                "Balancing Scales",
                "Capacity Comparison",
                "Heavy and Light"
            ],
            "outcomes": "Understand comparative mass and weight balance."
        },
        {
            "num": 4,
            "title": "Counting in Tens & Ones",
            "duration_weeks": 3,
            "topics": [
                "Two-digit Place Values",
                "Expanded Forms",
                "Abacus Basics"
            ],
            "outcomes": "Decompose numbers 1 to 99 into tens and units."
        },
        {
            "num": 5,
            "title": "Patterns and Symmetry",
            "duration_weeks": 2,
            "topics": [
                "Color Sequences",
                "Tessellation",
                "Repeating Border Motifs"
            ],
            "outcomes": "Construct and predict geometric patterns."
        },
        {
            "num": 6,
            "title": "Footprints and Shapes",
            "duration_weeks": 2,
            "topics": [
                "Animal Traces",
                "2D Outline of 3D Objects",
                "Circles, Squares, Triangles"
            ],
            "outcomes": "Trace outlines and match cross-sectional shapes."
        },
        {
            "num": 7,
            "title": "Jugs and Mugs (Liquid Volume)",
            "duration_weeks": 2,
            "topics": [
                "Capacity Estimation",
                "Filling Glasses",
                "Liters Concept Introduction"
            ],
            "outcomes": "Estimate and compare volumes of liquid containers."
        },
        {
            "num": 8,
            "title": "Tens and Ones Additions",
            "duration_weeks": 3,
            "topics": [
                "2-digit Addition without Regrouping",
                "Word Problems",
                "Mental Math"
            ],
            "outcomes": "Add double digit numbers mentally and on paper."
        }
    ],
    "MATH_3": [
        {
            "num": 1,
            "title": "Where to Look From",
            "duration_weeks": 2,
            "topics": [
                "Top, Front, and Side Views",
                "Grid Drawing",
                "Mirror Halves"
            ],
            "outcomes": "Develop 3D spatial perspective and symmetry recognition."
        },
        {
            "num": 2,
            "title": "Fun with Numbers (Up to 999)",
            "duration_weeks": 3,
            "topics": [
                "3-digit Numbers",
                "Place Value Chart",
                "Cricket Scoreboards Analysis"
            ],
            "outcomes": "Read, write, and compare numbers up to 1000."
        },
        {
            "num": 3,
            "title": "Give and Take (Addition)",
            "duration_weeks": 3,
            "topics": [
                "Adding with Regrouping",
                "Mental Math Shortcuts",
                "Word Problems"
            ],
            "outcomes": "Solve 3-digit additions with carry over accurately."
        },
        {
            "num": 4,
            "title": "Long and Short (Metric Length)",
            "duration_weeks": 2,
            "topics": [
                "Centimeters and Meters",
                "Using a Ruler",
                "Estimating Distances"
            ],
            "outcomes": "Measure standard lengths using metric instruments."
        },
        {
            "num": 5,
            "title": "Shapes and Designs",
            "duration_weeks": 2,
            "topics": [
                "Edges and Corners",
                "Tangrams",
                "Tiling Patterns"
            ],
            "outcomes": "Deconstruct polygons and assemble tangram figures."
        },
        {
            "num": 6,
            "title": "Fun with Give and Take (Subtraction)",
            "duration_weeks": 3,
            "topics": [
                "3-digit Subtraction with Borrowing",
                "Checking Answers with Addition"
            ],
            "outcomes": "Execute multi-digit subtractions with verification."
        },
        {
            "num": 7,
            "title": "Time Goes On",
            "duration_weeks": 2,
            "topics": [
                "Reading Analog Clocks",
                "Calendar Months & Days",
                "Timelines"
            ],
            "outcomes": "Tell clock time to the nearest 5 minutes and read calendars."
        },
        {
            "num": 8,
            "title": "Who is Heavier? (Kilograms & Grams)",
            "duration_weeks": 2,
            "topics": [
                "Standard Weights",
                "Beam Balances",
                "Grocery Weight Estimation"
            ],
            "outcomes": "Convert and measure masses in kilograms and grams."
        }
    ],
    "MATH_4": [
        {
            "num": 1,
            "title": "Building with Bricks",
            "duration_weeks": 2,
            "topics": [
                "Brick Patterns",
                "Arch Structures",
                "3D Wall Constructions",
                "Floor Inlays"
            ],
            "outcomes": "Identify architectural patterns and calculate rectangular face dimensions."
        },
        {
            "num": 2,
            "title": "Long and Short",
            "duration_weeks": 2,
            "topics": [
                "Centimeters, Meters, Kilometers",
                "Marathon Races",
                "Unit Conversions"
            ],
            "outcomes": "Convert metric length measurements and solve distance problems."
        },
        {
            "num": 3,
            "title": "A Trip to Bhopal (Math in Daily Life)",
            "duration_weeks": 3,
            "topics": [
                "Bus Travel Schedules",
                "Ticket Pricing Calculations",
                "Fuel Tank Rates"
            ],
            "outcomes": "Apply arithmetic operations to multi-step travel scenarios."
        },
        {
            "num": 4,
            "title": "Tick-Tick-Tick (Time & Clocks)",
            "duration_weeks": 2,
            "topics": [
                "12-hour vs 24-hour Clocks",
                "Train Timetable Schedules",
                "Elapsed Time"
            ],
            "outcomes": "Calculate duration and convert between 12-hour and 24-hour time."
        },
        {
            "num": 5,
            "title": "The Way the World Looks",
            "duration_weeks": 2,
            "topics": [
                "Aerial Mapping",
                "Isometric Drawings",
                "Navigating School Blueprints"
            ],
            "outcomes": "Interpret aerial maps and identify viewpoints from scale diagrams."
        },
        {
            "num": 6,
            "title": "The Junk Seller (Decimals & Multiplication)",
            "duration_weeks": 3,
            "topics": [
                "Currency Multiplication",
                "Cost Price & Selling Price",
                "Profit Estimation"
            ],
            "outcomes": "Perform double-digit multiplication and compute financial margins."
        },
        {
            "num": 7,
            "title": "Jugs and Mugs (Liters & Milliliters)",
            "duration_weeks": 2,
            "topics": [
                "Capacity Metrics",
                "Converting Liters to mL",
                "Recipe Ratios"
            ],
            "outcomes": "Solve liquid capacity word problems and volumetric balances."
        },
        {
            "num": 8,
            "title": "Carts and Wheels (Circles)",
            "duration_weeks": 2,
            "topics": [
                "Center, Radius, Diameter",
                "Drawing Circles with Compass",
                "Wheel Rotations"
            ],
            "outcomes": "Construct concentric circles and calculate perimeter relationships."
        },
        {
            "num": 9,
            "title": "Halves and Quarters (Fractions)",
            "duration_weeks": 3,
            "topics": [
                "Equal Sharing",
                "Fraction Representation (1/2, 1/4, 3/4)",
                "Equivalent Fractions"
            ],
            "outcomes": "Visually and numerically manipulate unit fractions."
        },
        {
            "num": 10,
            "title": "Play with Patterns",
            "duration_weeks": 2,
            "topics": [
                "Number Grids",
                "Secret Messages & Ciphers",
                "Rotational Symmetry"
            ],
            "outcomes": "Decode cipher puzzles and generate symmetric geometric patterns."
        }
    ],
    "MATH_5": [
        {
            "num": 1,
            "title": "The Fish Tale (Large Numbers)",
            "duration_weeks": 3,
            "topics": [
                "Lakhs and Crores",
                "Indian Place Value System",
                "Speed and Distance Problems"
            ],
            "outcomes": "Read and manipulate 6 to 8 digit numbers in real contexts."
        },
        {
            "num": 2,
            "title": "Shapes and Angles",
            "duration_weeks": 3,
            "topics": [
                "Right, Acute, and Obtuse Angles",
                "Angle Testers",
                "Angles in Alphabets & Clocks"
            ],
            "outcomes": "Measure and classify angles using protractors."
        },
        {
            "num": 3,
            "title": "How Many Squares? (Area & Perimeter)",
            "duration_weeks": 3,
            "topics": [
                "Area of Irregular Figures",
                "Square Grids",
                "Perimeter Optimization"
            ],
            "outcomes": "Calculate areas of composite polygons using unit squares."
        },
        {
            "num": 4,
            "title": "Parts and Wholes (Fraction Mastery)",
            "duration_weeks": 3,
            "topics": [
                "Mixed Numbers",
                "Improper Fractions",
                "Addition of Like Fractions"
            ],
            "outcomes": "Perform operational arithmetic on simple and mixed fractions."
        },
        {
            "num": 5,
            "title": "Does it Look the Same? (Symmetry)",
            "duration_weeks": 2,
            "topics": [
                "Mirror Reflection",
                "Quarter and Half Turns",
                "Rotational Symmetry Orders"
            ],
            "outcomes": "Determine invariance of figures under rotation and reflection."
        },
        {
            "num": 6,
            "title": "Be My Multiple, I'll be Your Factor",
            "duration_weeks": 3,
            "topics": [
                "LCM and HCF",
                "Factor Trees",
                "Prime Numbers Grid"
            ],
            "outcomes": "Factorize composite numbers and compute common multiples."
        },
        {
            "num": 7,
            "title": "Can You See the Pattern?",
            "duration_weeks": 2,
            "topics": [
                "Magic Squares & Triangles",
                "Number Palindromes",
                "Algebraic Sequences"
            ],
            "outcomes": "Formulate algebraic rules for expanding numeric series."
        },
        {
            "num": 8,
            "title": "Mapping Your Way",
            "duration_weeks": 2,
            "topics": [
                "Scale Ratios on Maps",
                "Route Optimization",
                "India Map State Boundaries"
            ],
            "outcomes": "Calculate physical ground distances using map scale legends."
        }
    ],
    "MATH_6": [
        {
            "num": 1,
            "title": "Knowing Our Numbers",
            "duration_weeks": 3,
            "topics": [
                "Indian and International Number Systems",
                "Estimation & Rounding",
                "Roman Numerals"
            ],
            "outcomes": "Convert and estimate values in millions, billions, and lakhs."
        },
        {
            "num": 2,
            "title": "Whole Numbers",
            "duration_weeks": 2,
            "topics": [
                "Number Line Representation",
                "Properties of Addition and Multiplication",
                "Patterns in Numbers"
            ],
            "outcomes": "Apply commutative, associative, and distributive properties."
        },
        {
            "num": 3,
            "title": "Playing with Numbers",
            "duration_weeks": 3,
            "topics": [
                "Divisibility Rules (2 through 11)",
                "Prime Factorization",
                "HCF and LCM Applications"
            ],
            "outcomes": "Solve complex real-world LCM and HCF word problems."
        },
        {
            "num": 4,
            "title": "Basic Geometrical Ideas",
            "duration_weeks": 3,
            "topics": [
                "Points, Lines, Rays, Segments",
                "Polygons, Triangles, Quadrilaterals",
                "Circles & Sectors"
            ],
            "outcomes": "Accurately name and define foundational geometric figures."
        },
        {
            "num": 5,
            "title": "Understanding Elementary Shapes",
            "duration_weeks": 2,
            "topics": [
                "Measuring Angles & Line Segments",
                "Right Angles and Direction",
                "3D Polyhedra"
            ],
            "outcomes": "Classify triangles by sides/angles and identify polyhedron faces."
        },
        {
            "num": 6,
            "title": "Integers",
            "duration_weeks": 3,
            "topics": [
                "Negative Numbers in Real Life",
                "Addition and Subtraction on Number Line",
                "Absolute Value"
            ],
            "outcomes": "Operate fluently with positive and negative integers."
        },
        {
            "num": 7,
            "title": "Fractions",
            "duration_weeks": 3,
            "topics": [
                "Proper, Improper, Mixed",
                "Equivalent Fractions",
                "Addition & Subtraction of Unlike Fractions"
            ],
            "outcomes": "Perform arithmetic on fractions with unlike denominators."
        },
        {
            "num": 8,
            "title": "Decimals",
            "duration_weeks": 2,
            "topics": [
                "Tenths and Hundredths",
                "Converting Fractions to Decimals",
                "Money and Weight Metrics"
            ],
            "outcomes": "Execute decimal calculations in measurement systems."
        },
        {
            "num": 9,
            "title": "Data Handling",
            "duration_weeks": 2,
            "topics": [
                "Tally Marks",
                "Pictographs",
                "Bar Graphs Interpretation and Construction"
            ],
            "outcomes": "Construct and analyze single bar charts for discrete data."
        },
        {
            "num": 10,
            "title": "Mensuration (Perimeter & Area)",
            "duration_weeks": 3,
            "topics": [
                "Perimeter of Regular Polygons",
                "Area of Rectangles and Squares",
                "Composite Figures"
            ],
            "outcomes": "Calculate perimeter and floor surface areas precisely."
        },
        {
            "num": 11,
            "title": "Introduction to Algebra",
            "duration_weeks": 3,
            "topics": [
                "Variables and Constants",
                "Algebraic Expressions",
                "Solving Simple Linear Equations"
            ],
            "outcomes": "Formulate algebraic expressions from verbal descriptions."
        },
        {
            "num": 12,
            "title": "Ratio and Proportion",
            "duration_weeks": 2,
            "topics": [
                "Concept of Ratio",
                "Proportion Equivalence",
                "Unitary Method Problems"
            ],
            "outcomes": "Apply the unitary method to solve speed, price, and work rates."
        }
    ],
    "MATH_7": [
        {
            "num": 1,
            "title": "Integers and Operations",
            "duration_weeks": 3,
            "topics": [
                "Multiplication and Division of Integers",
                "Properties of Integer Operations",
                "Word Scenarios"
            ],
            "outcomes": "Apply sign rules for products and quotients with integer properties."
        },
        {
            "num": 2,
            "title": "Fractions and Decimals",
            "duration_weeks": 3,
            "topics": [
                "Multiplication of Fractions",
                "Reciprocal and Division",
                "Decimal Division & Multiplications"
            ],
            "outcomes": "Solve compound arithmetic involving fractions and decimals."
        },
        {
            "num": 3,
            "title": "Data Handling",
            "duration_weeks": 2,
            "topics": [
                "Arithmetic Mean, Median, Mode",
                "Range Calculation",
                "Double Bar Graphs",
                "Probability Basics"
            ],
            "outcomes": "Compute central tendencies and construct double bar charts."
        },
        {
            "num": 4,
            "title": "Simple Linear Equations",
            "duration_weeks": 3,
            "topics": [
                "Forming Equations from Statements",
                "Transposition Method",
                "Real-world Applications"
            ],
            "outcomes": "Solve single-variable linear equations through systematic transposition."
        },
        {
            "num": 5,
            "title": "Lines and Angles",
            "duration_weeks": 3,
            "topics": [
                "Complementary and Supplementary Angles",
                "Adjacent and Linear Pairs",
                "Transversal Angles"
            ],
            "outcomes": "Prove geometric properties of parallel lines intersected by transversals."
        },
        {
            "num": 6,
            "title": "The Triangle and its Properties",
            "duration_weeks": 3,
            "topics": [
                "Medians and Altitudes",
                "Exterior Angle Theorem",
                "Angle Sum Property",
                "Pythagoras Theorem"
            ],
            "outcomes": "Apply angle-sum and Pythagoras theorem to right-angled triangles."
        },
        {
            "num": 7,
            "title": "Comparing Quantities",
            "duration_weeks": 3,
            "topics": [
                "Percentages to Fractions",
                "Profit and Loss",
                "Simple Interest (P*R*T/100)"
            ],
            "outcomes": "Compute financial percentage changes, profit margins, and interest accrued."
        },
        {
            "num": 8,
            "title": "Rational Numbers",
            "duration_weeks": 2,
            "topics": [
                "Standard Form of Rational Numbers",
                "Operations on Rational Numbers",
                "Density Property"
            ],
            "outcomes": "Perform four fundamental operations on rational numbers."
        },
        {
            "num": 9,
            "title": "Perimeter and Area",
            "duration_weeks": 3,
            "topics": [
                "Area of Parallelogram & Triangle",
                "Circumference and Area of Circle (pi*r^2)"
            ],
            "outcomes": "Derive and calculate circle areas, sectors, and polygon perimeters."
        },
        {
            "num": 10,
            "title": "Algebraic Expressions",
            "duration_weeks": 3,
            "topics": [
                "Monomials, Binomials, Polynomials",
                "Like and Unlike Terms",
                "Finding Values of Expressions"
            ],
            "outcomes": "Add, subtract, and evaluate multi-variable algebraic expressions."
        },
        {
            "num": 11,
            "title": "Exponents and Powers",
            "duration_weeks": 2,
            "topics": [
                "Laws of Exponents",
                "Standard Scientific Notation",
                "Prime Base Factorization"
            ],
            "outcomes": "Express astronomical and microscopic numbers in scientific notation."
        }
    ],
    "MATH_8": [
        {
            "num": 1,
            "title": "Rational Numbers",
            "duration_weeks": 2,
            "topics": [
                "Closure, Commutative, Associative Properties",
                "Distributive Law",
                "Additive & Multiplicative Inverses"
            ],
            "outcomes": "Demonstrate field properties for rational numbers."
        },
        {
            "num": 2,
            "title": "Linear Equations in One Variable",
            "duration_weeks": 3,
            "topics": [
                "Equations with Variables on Both Sides",
                "Age and Distance Word Problems",
                "Cross-multiplication"
            ],
            "outcomes": "Solve intricate applied linear models algebraically."
        },
        {
            "num": 3,
            "title": "Understanding Quadrilaterals",
            "duration_weeks": 3,
            "topics": [
                "Convex and Concave Polygons",
                "Sum of Interior Angles (n-2)*180",
                "Properties of Parallelograms, Rhombi, Trapezia"
            ],
            "outcomes": "Prove quadrilateral properties using diagonal and side theorems."
        },
        {
            "num": 4,
            "title": "Data Handling & Probability",
            "duration_weeks": 2,
            "topics": [
                "Frequency Distribution Tables",
                "Histograms",
                "Pie Charts Construction",
                "Random Events & Probability"
            ],
            "outcomes": "Plot grouped histograms and calculate geometric pie chart angles."
        },
        {
            "num": 5,
            "title": "Squares and Square Roots",
            "duration_weeks": 3,
            "topics": [
                "Pythagorean Triplets",
                "Prime Factorization Method",
                "Long Division Method for Roots"
            ],
            "outcomes": "Extract square roots of large integers and decimals accurately."
        },
        {
            "num": 6,
            "title": "Cubes and Cube Roots",
            "duration_weeks": 2,
            "topics": [
                "Hardy-Ramanujan Numbers",
                "Prime Factorization for Cube Roots",
                "Estimating Cube Roots"
            ],
            "outcomes": "Compute cube roots and explore volumetric cube expansions."
        },
        {
            "num": 7,
            "title": "Comparing Quantities",
            "duration_weeks": 3,
            "topics": [
                "Compound Interest Formula",
                "Compounded Annually and Half-yearly",
                "Depreciation Rates"
            ],
            "outcomes": "Calculate financial compounding, population growth, and depreciation."
        },
        {
            "num": 8,
            "title": "Algebraic Expressions and Identities",
            "duration_weeks": 3,
            "topics": [
                "Multiplying Polynomials",
                "Standard Identities (a+b)^2, (a-b)^2, (a^2-b^2)",
                "Identity Applications"
            ],
            "outcomes": "Expand and simplify polynomials using algebraic identities."
        },
        {
            "num": 9,
            "title": "Mensuration",
            "duration_weeks": 3,
            "topics": [
                "Surface Area of Cube, Cuboid, Cylinder",
                "Volume of 3D Solids",
                "Trapezium and General Quadrilateral Area"
            ],
            "outcomes": "Determine total surface area and fluid volumes for geometric solids."
        },
        {
            "num": 10,
            "title": "Exponents and Powers",
            "duration_weeks": 2,
            "topics": [
                "Negative Exponents",
                "Extended Laws of Powers",
                "Microscopic Metric Conversions"
            ],
            "outcomes": "Simplify compound exponential expressions with negative indices."
        },
        {
            "num": 11,
            "title": "Direct and Inverse Proportions",
            "duration_weeks": 2,
            "topics": [
                "Constant of Variation (k=y/x vs k=xy)",
                "Time and Work Problems",
                "Speed and Travel Proportions"
            ],
            "outcomes": "Formulate direct and inverse variation tables for physics and work."
        },
        {
            "num": 12,
            "title": "Factorisation",
            "duration_weeks": 3,
            "topics": [
                "Common Factors Method",
                "Regrouping Terms",
                "Splitting the Middle Term",
                "Division of Polynomials"
            ],
            "outcomes": "Factorize quadratic expressions and divide algebraic fractions."
        }
    ],
    "MATH_9": [
        {
            "num": 1,
            "title": "Number Systems",
            "duration_weeks": 3,
            "topics": [
                "Irrational Numbers Proofs",
                "Real Numbers on Number Line",
                "Rationalising Denominators",
                "Laws of Real Exponents"
            ],
            "outcomes": "Perform real number arithmetic and rationalise surd expressions."
        },
        {
            "num": 2,
            "title": "Polynomials",
            "duration_weeks": 3,
            "topics": [
                "Zeros of Polynomial",
                "Remainder Theorem",
                "Factor Theorem",
                "Algebraic Identities (Cubic & Quadratic)"
            ],
            "outcomes": "Factorize cubic polynomials using factor theorem and identities."
        },
        {
            "num": 3,
            "title": "Coordinate Geometry",
            "duration_weeks": 2,
            "topics": [
                "Cartesian Plane",
                "Abscissa and Ordinate",
                "Plotting Ordered Pairs in Quadrants"
            ],
            "outcomes": "Represent linear geometric relationships on coordinate grids."
        },
        {
            "num": 4,
            "title": "Linear Equations in Two Variables",
            "duration_weeks": 3,
            "topics": [
                "Standard Form ax+by+c=0",
                "Graphing Linear Equations",
                "Lines Parallel to x-axis and y-axis"
            ],
            "outcomes": "Graph two-variable linear equations and identify intercepts."
        },
        {
            "num": 5,
            "title": "Introduction to Euclid's Geometry",
            "duration_weeks": 1,
            "topics": [
                "Euclid's Axioms and Postulates",
                "Parallel Postulate Controversy",
                "Deductive Proofs"
            ],
            "outcomes": "Appreciate axiomatic foundations of Euclidean geometry."
        },
        {
            "num": 6,
            "title": "Lines and Angles",
            "duration_weeks": 3,
            "topics": [
                "Axiom of Linear Pair",
                "Vertically Opposite Angles Theorem",
                "Parallel Lines & Angle Sum Theorems"
            ],
            "outcomes": "Construct rigorous geometric proofs for intersecting lines."
        },
        {
            "num": 7,
            "title": "Triangles (Congruence)",
            "duration_weeks": 3,
            "topics": [
                "Criteria for Congruence (SAS, ASA, AAS, SSS, RHS)",
                "Isosceles Triangle Theorems"
            ],
            "outcomes": "Prove congruence of geometric figures with analytical rigor."
        },
        {
            "num": 8,
            "title": "Quadrilaterals",
            "duration_weeks": 3,
            "topics": [
                "Properties of Parallelograms",
                "Mid-point Theorem and Converse"
            ],
            "outcomes": "Apply Mid-point theorem to solve complex polygon geometry."
        },
        {
            "num": 9,
            "title": "Circles",
            "duration_weeks": 3,
            "topics": [
                "Equal Chords & Distances",
                "Angle Subtended by Arc at Center",
                "Cyclic Quadrilaterals Theorems"
            ],
            "outcomes": "Prove cyclic quadrilateral angle relationships and chord theorems."
        },
        {
            "num": 10,
            "title": "Heron's Formula",
            "duration_weeks": 2,
            "topics": [
                "Semi-perimeter s = (a+b+c)/2",
                "Area = sqrt(s(s-a)(s-b)(s-c))",
                "Applications in Land Surveying"
            ],
            "outcomes": "Calculate triangle and quadrilateral land areas without perpendiculars."
        },
        {
            "num": 11,
            "title": "Surface Areas and Volumes",
            "duration_weeks": 3,
            "topics": [
                "Right Circular Cones",
                "Spheres and Hemispheres",
                "Curved Surface Area & Volume"
            ],
            "outcomes": "Calculate composite curved surface areas and capacities for 3D curved solids."
        },
        {
            "num": 12,
            "title": "Statistics",
            "duration_weeks": 2,
            "topics": [
                "Bar Graphs, Histograms (Varying Width)",
                "Frequency Polygons"
            ],
            "outcomes": "Construct advanced frequency polygons for continuous empirical data."
        }
    ],
    "MATH_10": [
        {
            "num": 1,
            "title": "Real Numbers",
            "duration_weeks": 2,
            "topics": [
                "Fundamental Theorem of Arithmetic",
                "Proofs of Irrationality (sqrt 2, sqrt 3)",
                "Prime Factorization LCM/HCF"
            ],
            "outcomes": "Construct rigorous proofs of irrationality using prime factor theorem."
        },
        {
            "num": 2,
            "title": "Polynomials",
            "duration_weeks": 3,
            "topics": [
                "Geometrical Meaning of Zeros",
                "Relationship Between Zeros and Coefficients",
                "Quadratic & Cubic Polynomials"
            ],
            "outcomes": "Establish alpha-beta coefficient relationships for higher order polynomials."
        },
        {
            "num": 3,
            "title": "Pair of Linear Equations in Two Variables",
            "duration_weeks": 4,
            "topics": [
                "Graphical Solution",
                "Substitution Method",
                "Elimination Method",
                "Consistency Conditions"
            ],
            "outcomes": "Solve simultaneous linear systems and apply to commercial and speed models."
        },
        {
            "num": 4,
            "title": "Quadratic Equations",
            "duration_weeks": 3,
            "topics": [
                "Standard Form",
                "Factorisation Method",
                "Quadratic Formula (-b +- sqrt(D))/2a",
                "Nature of Roots"
            ],
            "outcomes": "Analyze discriminant D to classify real, distinct, or imaginary roots."
        },
        {
            "num": 5,
            "title": "Arithmetic Progressions (AP)",
            "duration_weeks": 3,
            "topics": [
                "nth Term of an AP (an = a + (n-1)d)",
                "Sum of First n Terms (Sn = n/2(2a+(n-1)d))",
                "Financial & Sequence Models"
            ],
            "outcomes": "Model and solve cumulative savings, loan amortizations, and sequence sums."
        },
        {
            "num": 6,
            "title": "Triangles (Similarity)",
            "duration_weeks": 4,
            "topics": [
                "Basic Proportionality Theorem (Thales)",
                "Converse of BPT",
                "Criteria for Similarity (AAA, SSS, SAS)"
            ],
            "outcomes": "Prove geometric similarity and apply scale factor ratios to architecture."
        },
        {
            "num": 7,
            "title": "Coordinate Geometry",
            "duration_weeks": 3,
            "topics": [
                "Distance Formula",
                "Section Formula (Internal Division)",
                "Centroid of a Triangle"
            ],
            "outcomes": "Compute coordinates of division points and collinearity conditions."
        },
        {
            "num": 8,
            "title": "Introduction to Trigonometry",
            "duration_weeks": 3,
            "topics": [
                "Trigonometric Ratios (sin, cos, tan, cot, sec, cosec)",
                "Ratios of 0, 30, 45, 60, 90 Degrees",
                "Trigonometric Identities (sin^2 + cos^2 = 1)"
            ],
            "outcomes": "Prove complex trigonometric identities and evaluate acute angle ratios."
        },
        {
            "num": 9,
            "title": "Some Applications of Trigonometry",
            "duration_weeks": 3,
            "topics": [
                "Line of Sight",
                "Angle of Elevation",
                "Angle of Depression",
                "Heights and Distances Problems"
            ],
            "outcomes": "Calculate heights of towers and distances of ships using trigonometric angles."
        },
        {
            "num": 10,
            "title": "Circles (Tangents)",
            "duration_weeks": 3,
            "topics": [
                "Tangent to a Circle at Point of Contact",
                "Length of Tangents from External Point",
                "Tangent Theorems"
            ],
            "outcomes": "Prove that lengths of tangents drawn from external points are equal."
        },
        {
            "num": 11,
            "title": "Areas Related to Circles",
            "duration_weeks": 2,
            "topics": [
                "Area of Sector of Angle theta",
                "Area of Segment of a Circle",
                "Designs in Circular Inlays"
            ],
            "outcomes": "Compute areas of complex circular segments and combined geometric regions."
        },
        {
            "num": 12,
            "title": "Surface Areas and Volumes",
            "duration_weeks": 3,
            "topics": [
                "Conversion of Solid from One Shape to Another",
                "Frustum and Composite Shapes",
                "Melting and Recasting Calculations"
            ],
            "outcomes": "Solve conservation of volume problems for melted and recast engineering bodies."
        },
        {
            "num": 13,
            "title": "Statistics",
            "duration_weeks": 2,
            "topics": [
                "Mean of Grouped Data (Direct & Assumed Mean)",
                "Mode of Grouped Data",
                "Median of Grouped Data"
            ],
            "outcomes": "Compute empirical mean, median, and mode for large frequency distributions."
        },
        {
            "num": 14,
            "title": "Probability",
            "duration_weeks": 2,
            "topics": [
                "Classical Definition of Probability",
                "Complementary Events",
                "Impossible and Sure Events",
                "Card & Dice Problems"
            ],
            "outcomes": "Calculate exact mathematical probabilities for complex multi-outcome scenarios."
        }
    ],
    "EVS_1": [
        {
            "num": 1,
            "title": "My Wonderful Body",
            "duration_weeks": 2,
            "topics": [
                "Five Senses",
                "Body Parts Functions",
                "Personal Hygiene & Grooming"
            ],
            "outcomes": "Name sense organs and practice good personal hygiene."
        },
        {
            "num": 2,
            "title": "My Family and Friends",
            "duration_weeks": 2,
            "topics": [
                "Nuclear & Joint Families",
                "Helping at Home",
                "Family Trees"
            ],
            "outcomes": "Understand familial relations and domestic cooperation."
        },
        {
            "num": 3,
            "title": "Food for Health",
            "duration_weeks": 2,
            "topics": [
                "Healthy Eating Habits",
                "Sources of Food (Plants & Animals)",
                "Clean Drinking Water"
            ],
            "outcomes": "Distinguish between wholesome foods and seasonal fruits."
        },
        {
            "num": 4,
            "title": "Clothes We Wear",
            "duration_weeks": 2,
            "topics": [
                "Cotton in Summer",
                "Woolens in Winter",
                "Raincoats in Monsoon"
            ],
            "outcomes": "Correlate clothing choices with seasonal weather shifts."
        },
        {
            "num": 5,
            "title": "Plants Around Us",
            "duration_weeks": 2,
            "topics": [
                "Trees, Shrubs, Herbs, Climbers",
                "Parts of a Plant",
                "Plant Care"
            ],
            "outcomes": "Classify common garden plants and identify leaves and roots."
        },
        {
            "num": 6,
            "title": "Animals: Our Friends",
            "duration_weeks": 2,
            "topics": [
                "Domestic vs Wild Animals",
                "Animal Homes & Sounds",
                "Caring for Pets"
            ],
            "outcomes": "Describe animal habitats and practice empathy toward animals."
        }
    ],
    "EVS_4": [
        {
            "num": 1,
            "title": "Going to School",
            "duration_weeks": 2,
            "topics": [
                "Modes of School Transport Across India",
                "Bamboo Bridges in Assam",
                "Vallam (Wooden Boats) in Kerala"
            ],
            "outcomes": "Understand geographic diversity and challenges children face across India."
        },
        {
            "num": 2,
            "title": "Ear to Ear (Animal Anatomy)",
            "duration_weeks": 2,
            "topics": [
                "External vs Internal Ears",
                "Feathers, Fur, and Scales",
                "Egg Laying vs Viviparous Animals"
            ],
            "outcomes": "Identify animal groups based on ear structures and body coverings."
        },
        {
            "num": 3,
            "title": "A Day with Nandu (Elephant Herd Dynamics)",
            "duration_weeks": 2,
            "topics": [
                "Elephant Herd Leadership (Matriarch)",
                "Animal Teamwork & Play",
                "Wildlife Conservation"
            ],
            "outcomes": "Analyze social structures in animal groups and biodiversity protection."
        },
        {
            "num": 4,
            "title": "The Story of Amrita (Bishnoi Community)",
            "duration_weeks": 2,
            "topics": [
                "Khejadi Trees in Rajasthan",
                "Sacred Groves",
                "Forest Protection Movements"
            ],
            "outcomes": "Appreciate indigenous environmental stewardship and forestry conservation."
        },
        {
            "num": 5,
            "title": "Anita and the Honeybees",
            "duration_weeks": 2,
            "topics": [
                "Apiculture (Beekeeping)",
                "Queen Bee, Drones, Workers",
                "Girl Child Education & Empowerment"
            ],
            "outcomes": "Understand social insect colonies and socio-economic empowerment."
        },
        {
            "num": 6,
            "title": "Omana's Journey (Rail Travel Geography)",
            "duration_weeks": 3,
            "topics": [
                "Train Route from Gujarat to Kerala",
                "Tunnels and Western Ghats",
                "Food Diversity at Stations"
            ],
            "outcomes": "Map railway journeys and interpret physical geography across state borders."
        }
    ],
    "SCI_6": [
        {
            "num": 1,
            "title": "Components of Food",
            "duration_weeks": 3,
            "topics": [
                "Carbohydrates, Fats, Proteins, Vitamins, Minerals",
                "Balanced Diet",
                "Deficiency Diseases (Scurvy, Beriberi, Rickets)"
            ],
            "outcomes": "Conduct chemical tests for starch/protein and design balanced nutrition diets."
        },
        {
            "num": 2,
            "title": "Sorting Materials into Groups",
            "duration_weeks": 2,
            "topics": [
                "Appearance & Lustre",
                "Hardness and Solubility",
                "Transparency (Opaque, Translucent, Transparent)"
            ],
            "outcomes": "Categorize materials based on optical and mechanical properties."
        },
        {
            "num": 3,
            "title": "Separation of Substances",
            "duration_weeks": 3,
            "topics": [
                "Handpicking, Threshing, Winnowing",
                "Sedimentation, Decantation, Filtration",
                "Evaporation & Condensation"
            ],
            "outcomes": "Select and execute appropriate physical methods to purify heterogeneous mixtures."
        },
        {
            "num": 4,
            "title": "Getting to Know Plants",
            "duration_weeks": 3,
            "topics": [
                "Root Systems (Taproot vs Fibrous)",
                "Leaf Venation (Reticulate vs Parallel)",
                "Flower Anatomy (Sepals, Petals, Stamens, Pistil)"
            ],
            "outcomes": "Correlate leaf venation with root types and dissect floral organs."
        },
        {
            "num": 5,
            "title": "Body Movements",
            "duration_weeks": 3,
            "topics": [
                "Human Skeletal System",
                "Types of Joints (Ball & Socket, Hinge, Pivotal)",
                "Locomotion in Earthworm, Snail, Fish, Birds"
            ],
            "outcomes": "Explain articulating skeletal biomechanics and animal propulsion mechanisms."
        },
        {
            "num": 6,
            "title": "The Living Organisms \u2014 Characteristics & Habitats",
            "duration_weeks": 3,
            "topics": [
                "Terrestrial & Aquatic Habitats",
                "Desert Adaptations (Camel, Cactus)",
                "Respiration, Stimuli, Excretion in Living Organisms"
            ],
            "outcomes": "Analyze physiological adaptations of species in extreme biomes."
        },
        {
            "num": 7,
            "title": "Motion and Measurement of Distances",
            "duration_weeks": 2,
            "topics": [
                "History of Transport",
                "Standard Units of Measurement (SI System)",
                "Rectilinear, Circular, and Periodic Motion"
            ],
            "outcomes": "Differentiate rectilinear, circular, and oscillatory periodic motions accurately."
        },
        {
            "num": 8,
            "title": "Light, Shadows and Reflections",
            "duration_weeks": 2,
            "topics": [
                "Luminous vs Non-luminous Objects",
                "Formation of Shadows",
                "Pinhole Camera Construction",
                "Plane Mirror Reflection"
            ],
            "outcomes": "Construct pinhole cameras and demonstrate rectilinear propagation of light."
        },
        {
            "num": 9,
            "title": "Electricity and Circuits",
            "duration_weeks": 3,
            "topics": [
                "Electric Cell Terminal Structure",
                "Closed and Open Circuits",
                "Electric Switch Mechanism",
                "Conductors vs Insulators"
            ],
            "outcomes": "Assemble functional electric circuits and evaluate conductive materials."
        },
        {
            "num": 10,
            "title": "Fun with Magnets",
            "duration_weeks": 2,
            "topics": [
                "Discovery of Magnets (Magnetite)",
                "Magnetic vs Non-magnetic Materials",
                "Poles of Magnet & Magnetic Compass",
                "Attraction and Repulsion Laws"
            ],
            "outcomes": "Fabricate makeshift magnetic compasses and map magnetic pole interactions."
        }
    ],
    "SCI_7": [
        {
            "num": 1,
            "title": "Nutrition in Plants",
            "duration_weeks": 3,
            "topics": [
                "Autotrophic vs Heterotrophic Nutrition",
                "Photosynthesis Reaction & Chlorophyll",
                "Parasitic & Insectivorous Plants (Cuscuta, Pitcher)",
                "Saprotrophic Fungi & Lichens"
            ],
            "outcomes": "Detail photosynthetic chloroplast reactions and symbiotic nitrogen fixation."
        },
        {
            "num": 2,
            "title": "Nutrition in Animals",
            "duration_weeks": 3,
            "topics": [
                "Human Alimentary Canal (Digestion Stages)",
                "Teeth Types and Tooth Decay",
                "Ruminant Digestion (Cattle Stomach Chambers)",
                "Amoeba Phagocytosis"
            ],
            "outcomes": "Diagram human peristalsis and enzymatic breakdown across digestive organs."
        },
        {
            "num": 3,
            "title": "Heat and Temperature",
            "duration_weeks": 3,
            "topics": [
                "Clinical vs Laboratory Thermometers",
                "Conduction, Convection, Radiation",
                "Sea Breeze and Land Breeze Phenomena",
                "Thermal Clothing Mechanics"
            ],
            "outcomes": "Explain fluid convection currents and measure temperature using calibrated devices."
        },
        {
            "num": 4,
            "title": "Acids, Bases and Salts",
            "duration_weeks": 3,
            "topics": [
                "Natural Indicators (Litmus, Turmeric, China Rose)",
                "Acidic vs Alkaline Characteristics",
                "Neutralization Reaction & Antacid Chemistry",
                "Daily Life Neutralization (Bee Stings, Soil Treatment)"
            ],
            "outcomes": "Conduct indicator titrations and explain pH neutralization in gastrointestinal relief."
        },
        {
            "num": 5,
            "title": "Physical and Chemical Changes",
            "duration_weeks": 3,
            "topics": [
                "Reversible vs Irreversible Changes",
                "Rusting of Iron & Galvanization",
                "Crystallization of Copper Sulphate",
                "Chemical Reaction Indicators (Gas, Heat, Color)"
            ],
            "outcomes": "Distinguish phase transformations from chemical bond changes with empirical tests."
        },
        {
            "num": 6,
            "title": "Respiration in Organisms",
            "duration_weeks": 3,
            "topics": [
                "Aerobic vs Anaerobic Respiration",
                "Human Respiratory System (Trachea, Lungs, Diaphragm)",
                "Breathing in Insects (Spiracles), Earthworms (Skin), Fish (Gills)"
            ],
            "outcomes": "Explain cellular ATP synthesis via cellular respiration and organismal gas exchange."
        },
        {
            "num": 7,
            "title": "Transportation in Animals and Plants",
            "duration_weeks": 3,
            "topics": [
                "Human Circulatory System (Heart Chambers, Blood Vessels, Pulse)",
                "Blood Components (RBC, WBC, Platelets)",
                "Excretory System (Kidneys & Dialysis)",
                "Xylem and Phloem Translocation"
            ],
            "outcomes": "Trace systemic vascular blood circulation and plant xylem sap transpiration."
        },
        {
            "num": 8,
            "title": "Reproduction in Plants",
            "duration_weeks": 3,
            "topics": [
                "Asexual Modes (Vegetative Propagation, Budding, Spore Formation)",
                "Sexual Reproduction in Flowers",
                "Pollination (Self vs Cross)",
                "Seed Dispersal Vectors"
            ],
            "outcomes": "Describe fertilization, zygote development, and seed distribution adaptations."
        },
        {
            "num": 9,
            "title": "Motion and Time",
            "duration_weeks": 2,
            "topics": [
                "Speed Calculation (Distance/Time)",
                "Simple Pendulum Time Period T = 2pi*sqrt(L/g)",
                "Distance-Time Graphs Interpretation"
            ],
            "outcomes": "Plot uniform and non-uniform speed kinematic graphs from experimental timer data."
        },
        {
            "num": 10,
            "title": "Electric Current and Its Effects",
            "duration_weeks": 3,
            "topics": [
                "Circuit Diagrams & Symbols",
                "Heating Effect of Electric Current (Nichrome, Fuses)",
                "Magnetic Effect: Electromagnets & Electric Bells"
            ],
            "outcomes": "Construct electromagnets and understand fuse safety in household wiring."
        },
        {
            "num": 11,
            "title": "Light and Optical Phenomena",
            "duration_weeks": 3,
            "topics": [
                "Reflection by Plane Mirrors (Virtual, Erect, Lateral Inversion)",
                "Concave vs Convex Mirrors",
                "Convex and Concave Lenses (Refraction)",
                "Newton's Disc & Spectrum of White Light"
            ],
            "outcomes": "Ray trace focal images in spherical mirrors and lenses for optical devices."
        }
    ],
    "PHY_9": [
        {
            "num": 1,
            "title": "Motion",
            "duration_weeks": 4,
            "topics": [
                "Distance vs Displacement",
                "Uniform & Non-uniform Motion",
                "Equations of Motion (v=u+at, s=ut+1/2at^2, v^2=u^2+2as)",
                "Uniform Circular Motion"
            ],
            "outcomes": "Derive kinematic equations of motion graphically and solve acceleration dynamics."
        },
        {
            "num": 2,
            "title": "Force and Laws of Motion",
            "duration_weeks": 4,
            "topics": [
                "Newton's First Law & Inertia",
                "Newton's Second Law (F=dp/dt=ma)",
                "Newton's Third Law (Action-Reaction)",
                "Conservation of Linear Momentum"
            ],
            "outcomes": "Solve impulse-momentum problems and apply Newton's dynamical principles to collisions."
        },
        {
            "num": 3,
            "title": "Gravitation",
            "duration_weeks": 3,
            "topics": [
                "Universal Law of Gravitation",
                "Free Fall & Acceleration Due to Gravity (g)",
                "Mass vs Weight",
                "Thrust, Pressure, and Archimedes' Principle",
                "Relative Density"
            ],
            "outcomes": "Calculate gravitational attraction forces and determine buoyant floatation conditions."
        },
        {
            "num": 4,
            "title": "Work and Energy",
            "duration_weeks": 3,
            "topics": [
                "Work Done by Force (W=F*s*cos theta)",
                "Kinetic Energy (1/2mv^2)",
                "Potential Energy (mgh)",
                "Law of Conservation of Energy",
                "Commercial Unit of Energy (kWh)"
            ],
            "outcomes": "Demonstrate mechanical energy conservation and compute electricity billing metrics."
        },
        {
            "num": 5,
            "title": "Sound",
            "duration_weeks": 3,
            "topics": [
                "Production & Propagation of Sound Waves",
                "Longitudinal vs Transverse Waves",
                "Characteristics (Frequency, Wavelength, Speed v=nu*lambda)",
                "Reflection of Sound & Sonar",
                "Structure of Human Ear"
            ],
            "outcomes": "Analyze acoustics, echo reverberation, and ultrasound transducer technologies."
        }
    ],
    "CHEM_9": [
        {
            "num": 1,
            "title": "Matter in Our Surroundings",
            "duration_weeks": 3,
            "topics": [
                "Particle Nature of Matter",
                "States of Matter (Solid, Liquid, Gas, Plasma, BEC)",
                "Latent Heat of Fusion & Vaporization",
                "Evaporation & Factors Affecting Cooling"
            ],
            "outcomes": "Explain phase thermodynamics and latent heat exchanges at molecular level."
        },
        {
            "num": 2,
            "title": "Is Matter Around Us Pure?",
            "duration_weeks": 3,
            "topics": [
                "Elements, Compounds, and Mixtures",
                "True Solutions, Colloids, and Suspensions",
                "Tyndall Effect & Brownian Movement",
                "Concentration of Solutions (Mass%)"
            ],
            "outcomes": "Differentiate homogeneous and colloidal dispersions using optical Tyndall scatter."
        },
        {
            "num": 3,
            "title": "Atoms and Molecules",
            "duration_weeks": 4,
            "topics": [
                "Laws of Chemical Combination",
                "Dalton's Atomic Theory",
                "Atomic Mass and Valency",
                "Writing Chemical Formulae",
                "Mole Concept & Avogadro's Number"
            ],
            "outcomes": "Balance empirical formulas and perform stoichiometric molar quantity calculations."
        },
        {
            "num": 4,
            "title": "Structure of the Atom",
            "duration_weeks": 4,
            "topics": [
                "Subatomic Particles (Protons, Neutrons, Electrons)",
                "Thomson & Rutherford Gold Foil Experiment",
                "Bohr Model of Atom",
                "Electronic Configuration (Bohr-Bury Rule)",
                "Isotopes and Isobars"
            ],
            "outcomes": "Diagram electron shell orbitals and explain radioactive isotopic mass numbers."
        }
    ],
    "BIO_9": [
        {
            "num": 1,
            "title": "The Fundamental Unit of Life (Cell)",
            "duration_weeks": 4,
            "topics": [
                "Prokaryotic vs Eukaryotic Cells",
                "Plasma Membrane & Osmosis/Diffusion",
                "Cell Wall & Plasmolysis",
                "Organelles: Nucleus, Mitochondria, ER, Golgi, Lysosomes, Plastids, Vacuoles"
            ],
            "outcomes": "Identify cellular ultrastructure and describe ATP production in mitochondria."
        },
        {
            "num": 2,
            "title": "Tissues",
            "duration_weeks": 4,
            "topics": [
                "Plant Tissues: Meristematic & Permanent (Parenchyma, Collenchyma, Sclerenchyma, Xylem, Phloem)",
                "Animal Tissues: Epithelial, Connective (Blood, Bone, Cartilage), Muscular (Striated, Smooth, Cardiac), Nervous"
            ],
            "outcomes": "Differentiate specialized histological tissues under compound light microscopes."
        },
        {
            "num": 3,
            "title": "Improvement in Food Resources",
            "duration_weeks": 3,
            "topics": [
                "Crop Variety Improvement & Hybridization",
                "Nutrient Management (Macro & Micronutrients, Fertilizers, Manure)",
                "Irrigation Systems & Crop Protection",
                "Animal Husbandry (Cattle, Poultry, Fisheries, Apiculture)"
            ],
            "outcomes": "Evaluate sustainable agricultural practices and livestock yield optimization."
        }
    ],
    "PHY_10": [
        {
            "num": 1,
            "title": "Light \u2014 Reflection and Refraction",
            "duration_weeks": 4,
            "topics": [
                "Spherical Mirrors (Concave & Convex)",
                "Mirror Formula & Magnification (1/f = 1/v + 1/u)",
                "Laws of Refraction & Snell's Law",
                "Refractive Index & Critical Angle",
                "Lens Formula & Power of Lens (P=1/f)"
            ],
            "outcomes": "Ray-trace complex optics and solve quantitative dioptric prescription lens equations."
        },
        {
            "num": 2,
            "title": "The Human Eye and the Colourful World",
            "duration_weeks": 3,
            "topics": [
                "Eye Anatomy & Accommodation of Eye",
                "Defects of Vision: Myopia, Hypermetropia, Presbyopia & Correction",
                "Refraction Through Triangular Prism",
                "Dispersion of White Light & Rainbow Formation",
                "Atmospheric Refraction (Twinkling of Stars)",
                "Scattering of Light (Tyndall Effect, Blue Sky)"
            ],
            "outcomes": "Design corrective optical lenses for visual defects and explain atmospheric scattering."
        },
        {
            "num": 3,
            "title": "Electricity",
            "duration_weeks": 4,
            "topics": [
                "Electric Current and Potential Difference (V=W/Q)",
                "Ohm's Law (V=IR) & Resistance Factors",
                "Resistivity (rho)",
                "Series and Parallel Combinations of Resistors",
                "Joule's Law of Heating (H=I^2Rt)",
                "Electric Power (P=VI=I^2R=V^2/R) & Commercial Energy Units"
            ],
            "outcomes": "Calculate equivalent network impedances and thermal dissipations in circuit grids."
        },
        {
            "num": 4,
            "title": "Magnetic Effects of Electric Current",
            "duration_weeks": 4,
            "topics": [
                "Magnetic Field Lines & Properties",
                "Oersted Experiment & Right-Hand Thumb Rule",
                "Magnetic Field Due to Current in Solenoid",
                "Fleming's Left-Hand Rule & Electric Motor Principle",
                "Electromagnetic Induction & Faraday's Law",
                "Fleming's Right-Hand Rule",
                "Domestic Electric Circuits & Safety Fuses/Earthing"
            ],
            "outcomes": "Analyze electromagnetic induction dynamics and design shock-proof grounding circuits."
        }
    ],
    "CHEM_10": [
        {
            "num": 1,
            "title": "Chemical Reactions and Equations",
            "duration_weeks": 3,
            "topics": [
                "Writing Balanced Chemical Equations",
                "Types: Combination, Decomposition, Displacement, Double Displacement",
                "Oxidation and Reduction (Redox)",
                "Corrosion Prevention & Rancidity Antioxidants"
            ],
            "outcomes": "Balance stoichiometry and identify electron transfer agents in redox reactions."
        },
        {
            "num": 2,
            "title": "Acids, Bases and Salts",
            "duration_weeks": 4,
            "topics": [
                "Chemical Properties of Acids & Bases",
                "pH Scale (0-14) & Daily Life Importance",
                "Salts from Chlor-Alkali Process (NaOH, Cl2, H2)",
                "Bleaching Powder, Baking Soda, Washing Soda",
                "Plaster of Paris & Water of Crystallization"
            ],
            "outcomes": "Evaluate pH equilibrium and outline industrial electrochemical salt synthesis."
        },
        {
            "num": 3,
            "title": "Metals and Non-Metals",
            "duration_weeks": 4,
            "topics": [
                "Physical & Chemical Properties",
                "Reactivity Series & Displacement Trends",
                "Ionic Bonding & Lattice Properties",
                "Metallurgy: Concentration of Ores, Roasting, Calcination, Refining",
                "Corrosion & Prevention (Alloying)"
            ],
            "outcomes": "Detail pyrometallurgical extraction protocols and thermodynamic ionic affinities."
        },
        {
            "num": 4,
            "title": "Carbon and Its Compounds",
            "duration_weeks": 4,
            "topics": [
                "Covalent Bonding in Carbon",
                "Versatile Nature: Catenation & Tetravalency",
                "Homologous Series & IUPAC Nomenclature",
                "Chemical Reactions: Combustion, Oxidation, Addition, Substitution",
                "Ethanol and Ethanoic Acid Properties",
                "Soaps and Detergents (Micelle Action)"
            ],
            "outcomes": "Name organic hydrocarbons under IUPAC and explain colloidal saponification micelles."
        }
    ],
    "BIO_10": [
        {
            "num": 1,
            "title": "Life Processes",
            "duration_weeks": 5,
            "topics": [
                "Autotrophic & Heterotrophic Nutrition",
                "Respiration: Glycolysis & Krebs Pathway",
                "Internal Transport: Double Circulation in Humans & Plant Xylem/Phloem",
                "Excretion: Nephron Anatomy & Urine Formation Mechanics"
            ],
            "outcomes": "Detail cellular bioenergetics, renal filtration mechanics, and cardiac cycles."
        },
        {
            "num": 2,
            "title": "Control and Coordination",
            "duration_weeks": 3,
            "topics": [
                "Nervous System (Neuron, Synaptic Transmission, Reflex Arc)",
                "Human Brain: Forebrain, Midbrain, Hindbrain",
                "Plant Hormones (Auxin, Gibberellin, Cytokinin, ABA) & Tropic Movements",
                "Endocrine Glands & Hormones (Thyroid, Pancreas, Pituitary, Adrenal)"
            ],
            "outcomes": "Explain synaptic neurotransmission, voluntary/involuntary responses, and feedback loops."
        },
        {
            "num": 3,
            "title": "How do Organisms Reproduce?",
            "duration_weeks": 4,
            "topics": [
                "DNA Copying & Variation Importance",
                "Asexual Reproduction in Microbes",
                "Sexual Reproduction in Flowering Plants (Double Fertilization)",
                "Human Reproductive System (Male & Female)",
                "Menstrual Cycle & Reproductive Health / Contraception"
            ],
            "outcomes": "Analyze embryological development, endocrine menstrual regulation, and contraception."
        },
        {
            "num": 4,
            "title": "Heredity and Evolution",
            "duration_weeks": 3,
            "topics": [
                "Mendel's Laws of Inheritance",
                "Monohybrid (3:1) and Dihybrid (9:3:3:1) Crosses",
                "Sex Determination in Humans (XX / XY Chromosomes)"
            ],
            "outcomes": "Construct Punnett squares for polygenic inheritance and explain chromosomal sex determination."
        },
        {
            "num": 5,
            "title": "Our Environment",
            "duration_weeks": 2,
            "topics": [
                "Ecosystems: Food Chains and Food Webs",
                "10 Percent Energy Law in Trophic Levels",
                "Biological Magnification of Toxins",
                "Ozone Layer Depletion & Waste Management (Biodegradable vs Non-biodegradable)"
            ],
            "outcomes": "Model thermodynamic trophic energy cascades and formulate eco-friendly waste management."
        }
    ],
    "CS_6": [
        {
            "num": 1,
            "title": "Computer System Overview & Hardware Architecture",
            "duration_weeks": 2,
            "topics": [
                "Input, Output, CPU (ALU, CU, Registers)",
                "Primary Memory (RAM, ROM) & Secondary Storage (SSD, HDD)",
                "System Software vs Application Software"
            ],
            "outcomes": "Understand Von Neumann computing architecture and hardware peripherals."
        },
        {
            "num": 2,
            "title": "File Management & Operating Systems",
            "duration_weeks": 2,
            "topics": [
                "Windows & Linux Directory Hierarchies",
                "File Extensions & Permissions",
                "Cloud Storage Synchronization"
            ],
            "outcomes": "Organize multi-tier folder trees and manage file security permissions."
        },
        {
            "num": 3,
            "title": "Algorithm Design & Flowcharting",
            "duration_weeks": 3,
            "topics": [
                "Step-by-Step Logic Formulation",
                "Standard Flowchart Symbols",
                "Conditional Branching (If-Else) & Loops"
            ],
            "outcomes": "Draft structured flowchart logic for computational problem solving."
        },
        {
            "num": 4,
            "title": "Introduction to Python Programming",
            "duration_weeks": 4,
            "topics": [
                "Python IDLE & Interactive Shell",
                "Variables, Data Types (int, float, str, bool)",
                "Basic I/O: input() and print()",
                "Arithmetic & Relational Operators"
            ],
            "outcomes": "Write interactive Python scripts utilizing variables, input prompts, and math operators."
        },
        {
            "num": 5,
            "title": "Artificial Intelligence Basics",
            "duration_weeks": 3,
            "topics": [
                "What is AI, ML, and Data Science?",
                "Smart Home Technologies & Voice Assistants",
                "Ethics of AI & Responsible Usage"
            ],
            "outcomes": "Identify machine intelligence applications and discuss digital ethical responsibilities."
        }
    ],
    "CS_9": [
        {
            "num": 1,
            "title": "Introduction to Python Programming Mastery",
            "duration_weeks": 4,
            "topics": [
                "Syntax & Indentation",
                "Conditional Statements (if-elif-else)",
                "Iterative Loops (for, while)",
                "Loop Control (break, continue)",
                "Built-in Functions"
            ],
            "outcomes": "Implement nested loops and branching logic to solve mathematical algorithms."
        },
        {
            "num": 2,
            "title": "Data Structures in Python (Lists & Strings)",
            "duration_weeks": 4,
            "topics": [
                "String Slicing & Methods",
                "List Operations (append, insert, pop, sort)",
                "List Comprehensions",
                "Tuple Basics"
            ],
            "outcomes": "Manipulate structured collections and execute sorting algorithms in Python."
        },
        {
            "num": 3,
            "title": "Cybersecurity & Digital Citizenship",
            "duration_weeks": 2,
            "topics": [
                "Malware Types (Viruses, Trojans, Ransomware)",
                "Phishing & Social Engineering",
                "Two-Factor Authentication & Strong Passwords",
                "Cyber Law & Intellectual Property Rights"
            ],
            "outcomes": "Protect personal cyber hygiene and identify digital fraud vectors."
        },
        {
            "num": 4,
            "title": "AI Project Cycle & Machine Learning Domains",
            "duration_weeks": 3,
            "topics": [
                "Problem Scoping",
                "Data Acquisition & Exploration",
                "Modeling (Supervised vs Unsupervised)",
                "Evaluation & Computer Vision Basics"
            ],
            "outcomes": "Formulate end-to-end AI project lifecycles from data collection to testing."
        }
    ],
    "CS_10": [
        {
            "num": 1,
            "title": "Advanced Python & Modular Programming",
            "duration_weeks": 4,
            "topics": [
                "User-defined Functions (def, parameters, return)",
                "Scope of Variables (Local vs Global)",
                "Dictionaries & Sets in Python",
                "File Handling Basics (Reading and Writing Text Files)"
            ],
            "outcomes": "Construct modular, reusable Python libraries and manipulate external files."
        },
        {
            "num": 2,
            "title": "Relational Databases & SQL Queries",
            "duration_weeks": 4,
            "topics": [
                "RDBMS Concepts & Primary Keys",
                "SQL DDL: CREATE, ALTER, DROP",
                "SQL DML: SELECT, INSERT, UPDATE, DELETE",
                "Filtering with WHERE, ORDER BY, GROUP BY"
            ],
            "outcomes": "Write structured relational queries to manipulate enterprise database tables."
        },
        {
            "num": 3,
            "title": "Computer Vision & Natural Language Processing",
            "duration_weeks": 3,
            "topics": [
                "Image Processing (Pixels, RGB, Edge Detection)",
                "Text Pre-processing (Tokenization, Stopwords, Stemming)",
                "Chatbot Design & Sentiment Analysis"
            ],
            "outcomes": "Build rule-based NLP bots and analyze convolutional image pixels."
        },
        {
            "num": 4,
            "title": "Societal Impacts of AI & Neural Networks",
            "duration_weeks": 2,
            "topics": [
                "Deep Learning & Biological vs Artificial Neurons",
                "Algorithmic Bias & Data Privacy",
                "Future of Work & Ethical AI Governance"
            ],
            "outcomes": "Critique algorithmic bias and explore deep neural network layers."
        }
    ]
}

SUBJECT_STRANDS = {
    "ENG": ["Reading and Literature", "Grammar and Language Use", "Writing and Composition", "Speaking, Listening and Projects"],
    "HIN": ["पठन एवं साहित्य", "व्याकरण एवं भाषा", "रचनात्मक लेखन", "श्रवण-वाचन एवं परियोजना"],
    "SKT": ["संस्कृत पठन", "व्याकरण", "शब्दरूप एवं धातुरूप", "संवाद एवं रचना"],
    "EVS": ["Family and Community", "Food, Water and Shelter", "Plants, Animals and Habitats", "Travel, Work and Environmental Care"],
    "SCI": ["Matter and the Physical World", "Living Systems", "Motion, Energy and Natural Phenomena", "Environment, Health and Scientific Inquiry"],
    "SST": ["History and Heritage", "Geography and Environment", "Civics and Democratic Life", "Economics, Society and Sustainable Development"],
    "CTAI": ["Digital Literacy and Safety", "Computational Thinking", "Data and Artificial Intelligence", "Responsible Innovation Project"],
    "SKILL": ["Work, Tools and Safety", "Design and Making", "Community and Vocational Exploration", "Kaushal Project and Reflection"],
    "ART": ["Visual Expression", "Music, Movement and Theatre", "Indian Arts and Cultural Heritage", "Creative Portfolio"],
    "PET": ["Movement and Fitness", "Games and Sports Skills", "Health, Nutrition and Well-being", "Yoga, Teamwork and Fair Play"],
    "CS": ["Digital Systems", "Programming and Algorithms", "Data and Networks", "Cyber Safety and Applied Project"],
}


def get_chapters_for_subject_and_grade(subject_code: str, grade_number: int) -> List[Dict[str, Any]]:
    """Retrieves syllabus chapters for a specific subject and grade number."""
    key = f"{subject_code}_{grade_number}"
    if key in CHAPTERS_DB:
        return CHAPTERS_DB[key]
    
    # Every subject offered by the CBSE-aligned scheme receives grade-specific
    # competency units instead of borrowing another grade's textbook chapters.
    strands = SUBJECT_STRANDS.get(subject_code)
    if strands:
        return [
            {
                "num": index,
                "title": title,
                "duration_weeks": 4,
                "topics": [
                    f"Class {grade_number} Core Concepts",
                    "NCERT-aligned Activities and Examples",
                    "Competency-based Practice",
                    "Assessment and Portfolio Evidence",
                ],
                "outcomes": f"Demonstrate Class {grade_number} competency in {title.lower()} through application and reflection.",
            }
            for index, title in enumerate(strands, start=1)
        ]
    
    # Generic high quality fallback chapters
    return [
        {
            "num": 1,
            "title": f"Foundations of {subject_code} - Term 1 Principles",
            "duration_weeks": 3,
            "topics": ["Core Definitions", "Historical Background", "Fundamental Axioms", "Practical Examples"],
            "outcomes": f"Master initial conceptual principles of {subject_code}."
        },
        {
            "num": 2,
            "title": f"Applied Methods & Analytical Tools",
            "duration_weeks": 4,
            "topics": ["Methodological Frameworks", "Problem Solving Strategies", "Case Studies", "Laboratory Verification"],
            "outcomes": "Apply analytical techniques to resolve complex discipline questions."
        },
        {
            "num": 3,
            "title": f"Intermediate Synthesis & Project Work",
            "duration_weeks": 4,
            "topics": ["Integrated Modeling", "Collaborative Exercises", "Data Evaluation", "Field Observations"],
            "outcomes": "Synthesize multiple topics into unified project assessments."
        },
        {
            "num": 4,
            "title": f"Advanced Topics & Term Examination Preparation",
            "duration_weeks": 3,
            "topics": ["Sample Paper Review", "Error Analysis", "Advanced Inquiry", "Board Review Mastery"],
            "outcomes": "Demonstrate complete subject competency under standard testing criteria."
        }
    ]
