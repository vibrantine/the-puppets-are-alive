// Defines the afraid emotion using the original v1 poses and timing.
// spark is the one-time entry reaction; idle and speaking are repeating sequences.
// Each checkpoint specifies arm, head and body destinations plus travel time.
// ExpressionPlayer owns the clock and blends between these poses for each puppet.
// Keeping this choreography here lets us tune one emotion independently.
// Afraid expression: authored spark, idle and speaking destinations; playback owns all state.
// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const afraidEmotion = {
    name: 'afraid',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 76, right: 70 },
                head: { nod: -18, tilt: -12 },
                bodyOffsets: { lean: -14, swayAngle: 3, bobOffset: -3 },
                moveSeconds: 0.16
            },
            {
                armOffsets: { left: 68, right: 55 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.32
            }
        ]
    },
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 63, right: 55 },
                head: { nod: -10, tilt: -12 },
                bodyOffsets: { lean: -9, swayAngle: -0.8, bobOffset: 0 },
                moveSeconds: 0.45
            },
            {
                armOffsets: { left: 70, right: 55 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -9, swayAngle: 0.8, bobOffset: -1 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 68, right: 50 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -9, swayAngle: -0.6, bobOffset: 0 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 68, right: 55 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -11, swayAngle: 0.6, bobOffset: 0 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 65, right: 55 },
                head: { nod: -12, tilt: -10 },
                bodyOffsets: { lean: -11, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 68, right: 55 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 10, right: 73 },
                head: { nod: -2, tilt: -7 },
                bodyOffsets: { lean: -12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 10, right: 73 },
                head: { nod: -2, tilt: -7 },
                bodyOffsets: { lean: -12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 74, right: 7 },
                head: { nod: -7, tilt: -2 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 74, right: 7 },
                head: { nod: -7, tilt: -2 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 40, right: 35 },
                head: { nod: -5, tilt: -10 },
                bodyOffsets: { lean: -8, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 74, right: 73 },
                head: { nod: -13, tilt: -10 },
                bodyOffsets: { lean: -12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.55
            },
            {
                armOffsets: { left: 74, right: 73 },
                head: { nod: -13, tilt: -10 },
                bodyOffsets: { lean: -12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.4
            },
            {
                armOffsets: { left: 48, right: 25 },
                head: { nod: -10, tilt: -6 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.55
            },
            {
                armOffsets: { left: 68, right: 55 },
                head: { nod: -10, tilt: -10 },
                bodyOffsets: { lean: -9, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.8
            }
        ]
    }
};
