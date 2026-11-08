// Defines the choreography for a puppet feeling neutral. ExpressionPlayer reads
// three sequences: a short entry reaction (spark), an idle loop and a speaking
// loop. Each checkpoint gives a destination pose and the seconds to reach it.
// Arm and head angles are in degrees; body bob is in stage units (negative is up).
// Repeat a pose to hold it. Edit these values to change the performance without
// changing the player that keeps time.

// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const neutralEmotion = {
    name: 'neutral',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 8, right: 4 },
                head: { nod: 3, tilt: 0 },
                bodyOffsets: { lean: 1, swayAngle: 0, bobOffset: -2 },
                moveSeconds: 0.22
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.25
            }
        ]
    },
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: 1 },
                bodyOffsets: { lean: 0, swayAngle: 1, bobOffset: -1 },
                moveSeconds: 1.5
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.5
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: -1 },
                bodyOffsets: { lean: 0, swayAngle: -1, bobOffset: 1 },
                moveSeconds: 1.5
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.5
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 40, right: 4 },
                head: { nod: 3, tilt: 0 },
                bodyOffsets: { lean: 2, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 40, right: 4 },
                head: { nod: 3, tilt: 0 },
                bodyOffsets: { lean: 2, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 10, right: 6 },
                head: { nod: 0, tilt: -2 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 4, right: 32 },
                head: { nod: -2, tilt: 3 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 4, right: 32 },
                head: { nod: -2, tilt: 3 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 20, right: 18 },
                head: { nod: 3, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.75
            },
            {
                armOffsets: { left: 20, right: 18 },
                head: { nod: 3, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 0, tilt: 0 },
                bodyOffsets: { lean: 0, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            }
        ]
    }
};
